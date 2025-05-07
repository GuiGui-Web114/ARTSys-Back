const express = require('express');
const DB_Table = require('../../bd/tabels'); 
const multer = require('multer');
const fs = require('fs');
const sendEmail = require('../mail');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const dotenv = require('dotenv');
const path = require('path');
const router = express.Router();
const { fn, col, literal, Op } = require('sequelize');

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;

function verificarToken(req, res, next) {
  const token = req.headers['x-access-token'];
  console.log(token)
  if (!token) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Erro na verificação do token:", err.message);
    return res.status(403).json({ erro: "Token inválido" });
  }
}
function verificarPermissao(...tiposPermitidos) {
  return (req, res, next) => {
    console.log("Verificando permissão para:", req.user.tipo);

    if (!req.user || !tiposPermitidos.includes(req.user.tipo)) {
      return res.status(403).json({ estado: "falhou", erro: "Permissão negada" });
    }

    next();
  };
}

router.use(express.json());
router.use(verificarToken)

router.get('/dashboard/entregas-mensais', async (req, res) => {
  try {
    const entregas = await DB_Table.Entrega.findAll({
      attributes: [
        [fn('MONTH', col('createdAt')), 'mes'],
        [fn('COUNT', col('id')), 'entregas']
      ],
      group: ['mes'],
      order: [[literal('mes'), 'ASC']]
    });
    res.status(200).json(entregas);
  } catch (error) {
    console.error('Erro ao buscar entregas mensais:', error);
    res.status(500).json({ error: "Erro ao buscar entregas mensais." });
  }
});
router.get('/dashboard/estatisticas', verificarPermissao("Administrador"), async (req, res) => {
  try {
    const motoristasAtivos = await DB_Table.Motorista.count();
    const veiculosDisponiveis = await DB_Table.Viatura.count({ where: { status: 'Disponível' } });
    const veiculosProblema = await DB_Table.Entrega.count({
      where: {
        [Op.or]: [
          { status: 'Aceite' },
          { status: 'Em Viagem' },
          { status: 'Entregue' }
        ]
      }
    });
    const falhasEntregas = await DB_Table.Entrega.count({
      where: {
        [Op.or]: [
          { status: 'Negado' },
        ]
      }
    });

    res.status(200).json({
      motoristasAtivos,
      veiculosDisponiveis,
      veiculosProblema,
      falhasEntregas
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas gerais:', error);
    res.status(500).json({ error: "Erro ao buscar estatísticas gerais." });
  }
});
router.get('/dashboard/eficiencia-veiculo/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    const registros = await DB_Table.Abastecendo.findAll({
      where: { matricula },
      order: [['dataHora', 'ASC']]
    });

    if (registros.length < 2) {
      return res.status(200).json({
        eficiencia: null,
        message: 'Dados insuficientes para calcular eficiência.'
      });
    }

    const kmInicio = Number(registros[0].kilometragem);
    const kmFim = Number(registros[registros.length - 1].kilometragem);
    const distancia = kmFim - kmInicio;
    const totalCombustivel = registros.reduce((acc, curr) => acc + Number(curr.combustivel), 0);

    if (totalCombustivel === 0) {
      return res.status(200).json({
        eficiencia: null,
        message: 'Consumo de combustível zero, não é possível calcular eficiência.'
      });
    }

    const eficiencia = distancia / totalCombustivel;
    res.status(200).json({ eficiencia });
  } catch (error) {
    console.error('Erro ao calcular eficiência do veículo:', error);
    res.status(500).json({ error: "Erro ao calcular eficiência do veículo." });
  }
});
router.get('/me', async (req, res) => {
  try {
    const usuario = await DB_Table.User.findByPk(req.query.id, {
      attributes: { exclude: ['password'] }
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado!" });
    }

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuário!" });
  }
});
router.get('/users', verificarPermissao("Administrador"), async (req, res) => {

  try {
    const usuarios = await DB_Table.User.findAll({
      attributes: { exclude: ['password'] }
    });

    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuários!" });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Ex: 1636563456789.jpg
  }
});
const upload = multer({ storage });

router.post('/motoristas', verificarPermissao("Administrador"), upload.single('imagem'), async (req, res) => {
  try {
    const { nome, contacto, numero_passe } = req.body;
    if (!nome || !contacto || !numero_passe) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    const imagem = req.file ? req.file.filename : null;
    const novoMotorista = await DB_Table.Motorista.create({
      nome,
      contacto,
      numero_passe,
      imagem
    });
    res.status(201).json(novoMotorista);
  } catch (error) {
    console.error("Erro ao cadastrar motorista:", error);
    res.status(500).json({ error: "Erro ao cadastrar motorista." });
  }
});
router.get('/all/motoristas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const motoristas = await DB_Table.Motorista.findAll();

    const motoristasFormatados = motoristas.map(motorista => ({
      id: motorista.id,
      nome: motorista.nome,
      contacto: motorista.contacto,
      numero_passe: motorista.numero_passe,
      imagem: motorista.imagem ? `/uploads/${motorista.imagem}` : null
    }));

    res.status(200).json(motoristasFormatados);
  } catch (error) {
    console.error("Erro ao buscar motoristas:", error);
    res.status(500).json({ error: "Erro ao buscar motoristas." });
  }
});
router.post('/criar/veiculos', verificarPermissao("Administrador", "Plantao"), upload.single('imagem'), async (req, res) => {
  try {
    console.log(" Dados recebidos no Back-end:", req.body, req.file);

    if (!req.body.matricula) {
      return res.status(400).json({ error: "Os dados do formulário não foram enviados corretamente." });
    }

    const { matricula, codigo, modelo, motorista, status } = req.body;

    if (!matricula || !codigo || !modelo || !motorista || !status) {
      return res.status(400).json({ error: "Campos obrigatórios: matricula, codigo, modelo, motorista e status." });
    }

    let modeloRegistro = await DB_Table.Modelo.findOne({ where: { modelo } });
    if (!modeloRegistro) {
      modeloRegistro = await DB_Table.Modelo.create({ modelo });
    }

    let motoristaRegistro = await DB_Table.Motorista.findOne({ where: { nome: motorista } });
    if (!motoristaRegistro) {
      return res.status(404).json({ error: "Motorista não encontrado." });
    }

    let nomeDaImagem = req.file ? req.file.filename : null;
    console.log(" Imagem recebida:", nomeDaImagem || "Nenhuma imagem enviada");

    //  Cria o Veículo no banco
    const novoVeiculo = await DB_Table.Viatura.create({
      matricula,
      codigo,
      modeloId: modeloRegistro.id,
      modelo: modeloRegistro.modelo,
      motoristaId: motoristaRegistro.id,
      status,
      imagem: nomeDaImagem
    });

    console.log("Veículo cadastrado com sucesso:", novoVeiculo);
    return res.status(201).json({ message: "Veículo cadastrado com sucesso!", veiculo: novoVeiculo });

  } catch (error) {
    console.error(" Erro ao cadastrar veículo:", error);
    return res.status(500).json({ error: "Erro ao cadastrar veículo." });
  }
});
router.get('/veiculos', verificarPermissao("Administrador", "Plantao", "Oficina"), async (req, res) => {
  try {
    const vehicles = await DB_Table.Viatura.findAll({
      attributes: ['id', 'matricula', 'codigo', 'modelo', 'status', 'imagem', 'createdAt', 'updatedAt'], //  Adicionamos 'status' e 'imagem'
      include: [
        {
          model: DB_Table.Motorista,
          attributes: ['id', 'nome', 'contacto', 'numero_passe']
        },
        {
          model: DB_Table.Modelo,
          as: 'modeloViatura',
          attributes: ['id', 'modelo']
        }
      ]
    });

    console.log(" Veículos retornados:", vehicles);
    res.json(vehicles);
  } catch (error) {
    console.error(" Erro ao buscar veículos:", error);
    res.status(500).json({ error: "Erro ao buscar veículos" });
  }
});
router.put('/atualizar/veiculo/:id', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const { id } = req.params;
    const { matricula, codigo, motorista, status } = req.body;

    if (!matricula || !codigo || !motorista || !status) {
      return res.status(400).json({ error: "Campos obrigatórios: matricula, codigo, motorista e status." });
    }

    const veiculo = await DB_Table.Viatura.findByPk(id);
    if (!veiculo) {
      return res.status(404).json({ error: "Veículo não encontrado." });
    }


    const motoristaRegistro = await DB_Table.Motorista.findOne({ where: { nome: motorista } });
    if (!motoristaRegistro) {
      return res.status(404).json({ error: "Motorista não encontrado." });
    }


    await veiculo.update({
      matricula,
      codigo,
      motoristaId: motoristaRegistro.id,
      status
    });

    return res.status(200).json({ message: "Veículo atualizado com sucesso!", veiculo });

  } catch (error) {
    console.error(" Erro ao atualizar veículo:", error);
    return res.status(500).json({ error: "Erro ao atualizar veículo." });
  }
});
router.get('/agencias', async (req, res) => {
  try {
    const agencias = await DB_Table.Agencia.findAll({
      include: [{ model: DB_Table.Municipio_Agencia }]
    });
    res.json(agencias);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar agências" });
  }
});
router.get('/marcas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const marcas = await DB_Table.Marca.findAll({
      order: [['marca', 'ASC']]
    });
    res.json(marcas);
  } catch (error) {
    console.error("Erro ao buscar marcas:", error);
    res.status(500).json({ error: "Erro ao buscar marcas" });
  }
});
router.get('/modelos', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const modelos = await DB_Table.Modelo.findAll({
      order: [['modelo', 'ASC']]
    });
    res.json(modelos);
  } catch (error) {
    console.error("Erro ao buscar modelos:", error);
    res.status(500).json({ error: "Erro ao buscar modelos" });
  }
});
router.get('/cargas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const cargas = await DB.Carga.findAll({
      include: [
        { model: DB_Table.Viatura, as: 'viatura' },
        { model: DB_Table.Agencia, as: 'agencia' },
        { model: DB_Table.Municipio_Agencia, as: 'municipioOrigem' },
        { model: DB_Table.Municipio_Agencia, as: 'municipioDestino' }
      ]
    });
    res.json(cargas);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar cargas" });
  }
});
router.post('/cargas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const { nome_produto, destinatario, agenciaId, municipioOrigemId, municipioDestinoId, viaturaId } = req.body;
    const newCarga = await DB_Table.Carga.create({
      nome_produto,
      destinatario,
      agenciaId,
      municipioOrigemId,
      municipioDestinoId,
      viaturaId
    });
    res.status(201).json(newCarga);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar carga" });
  }
});
router.post('/entradas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const {
      dataHora,
      codigoVeiculo,
      passeMotorista,
      passeCobrador,
      kilometragem,
      tipoViagem,
      agencia,
      observacao,
      teveAvaria,
      descricaoAvaria
    } = req.body;

    const ultimaSaida = await DB_Table.Saida.findOne({
      where: { codigoVeiculo },
      order: [['dataHora', 'DESC']]
    });

    const ultimaEntrada = await DB_Table.Entrada.findOne({
      where: { codigoVeiculo },
      order: [['dataHora', 'DESC']]
    });

    if (!ultimaSaida) {
      return res.status(400).json({ error: "Não há saída registrada para este veículo. Registre a saída primeiro." });
    }

    if (ultimaEntrada && new Date(ultimaEntrada.dataHora) > new Date(ultimaSaida.dataHora)) {
      return res.status(400).json({ error: "O veículo já registrou uma entrada para a última saída." });
    }

    if (new Date(dataHora) <= new Date(ultimaSaida.dataHora)) {
      return res.status(400).json({ error: "A entrada não pode ser registrada antes da última saída." });
    }

    if (Number(kilometragem) <= Number(ultimaSaida.kilometragemFinal)) {
      return res.status(400).json({ error: "A kilometragem da entrada deve ser maior que a última saída." });
    }

    //  REGISTRA ENTRADA
    const novaEntrada = await DB_Table.Entrada.create({
      dataHora,
      codigoVeiculo,
      passeMotorista,
      passeCobrador,
      kilometragem,
      tipoViagem,
      agencia,
      observacao,
      teveAvaria,
      descricaoAvaria
    });

    //  ATUALIZA STATUS DO VEÍCULO
    const novoStatus = teveAvaria === "sim" ? "Manutenção" : "Disponível";
    await DB_Table.Viatura.update(
      { status: novoStatus },
      { where: { codigo: codigoVeiculo } }
    );

    return res.status(201).json({ message: "Entrada registrada e status atualizado!", novaEntrada });
  } catch (error) {
    console.error("Erro no endpoint /entradas:", error);
    return res.status(500).json({ error: "Erro ao registrar entrada de veículo" });
  }
});
router.post('/saidas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const {
      dataHora,
      MatriculaVeiculo,
      codigoVeiculo,
      passeMotorista,
      passeCobrador,
      kilometragemFinal,
      tipoViagem,
      agencia,
      observacao
    } = req.body;

    const ultimaEntrada = await DB_Table.Entrada.findOne({
      where: { codigoVeiculo },
      order: [['dataHora', 'DESC']]
    });

    const ultimaSaida = await DB_Table.Saida.findOne({
      where: { codigoVeiculo },
      order: [['dataHora', 'DESC']]
    });

    if (!ultimaEntrada && !ultimaSaida) {
      const novaSaida = await DB_Table.Saida.create({
        dataHora,
        MatriculaVeiculo,
        codigoVeiculo,
        passeMotorista,
        passeCobrador,
        kilometragemFinal,
        tipoViagem,
        agencia,
        observacao
      });

      await DB_Table.Viatura.update(
        { status: "Em Uso" },
        { where: { codigo: codigoVeiculo } }
      );

      return res.status(201).json({ message: "Saída registrada e status atualizado!", novaSaida });
    }

    if (ultimaSaida && (!ultimaEntrada || new Date(ultimaSaida.dataHora) > new Date(ultimaEntrada.dataHora))) {
      return res.status(400).json({ error: "O veículo já registrou uma saída sem entrada correspondente." });
    }

    if (ultimaEntrada && new Date(dataHora) <= new Date(ultimaEntrada.dataHora)) {
      return res.status(400).json({ error: "A saída não pode ser registrada antes da última entrada." });
    }

    const novaSaida = await DB_Table.Saida.create({
      dataHora,
      MatriculaVeiculo,
      codigoVeiculo,
      passeMotorista,
      passeCobrador,
      kilometragemFinal,
      tipoViagem,
      agencia,
      observacao
    });


    await DB_Table.Viatura.update(
      { status: "Em Uso" },
      { where: { codigo: codigoVeiculo } }
    );

    return res.status(201).json({ message: "Saída registrada e status atualizado!", novaSaida });
  } catch (error) {
    console.error("Erro no endpoint /saidas:", error);
    return res.status(500).json({ error: "Erro ao registrar saída de veículo" });
  }
});
router.get('/all/entradas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {

    const todasEntradas = await DB_Table.Entrada.findAll({
      order: [['id', 'DESC']]
    });

    if (todasEntradas.length > 0) {
      res.status(200).json(todasEntradas);
    } else {
      res.status(404).json({ message: "Nenhuma entrada registrada" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter entradas de veículos" });
  }
});
router.get('/all/saidas', verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const todasSaidas = await DB_Table.Saida.findAll({
      order: [['id', 'DESC']]
    });
    if (todasSaidas.length > 0) {
      res.status(200).json(todasSaidas);
    } else {
      res.status(404).json({ message: "Nenhuma saída registrada" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter saídas de veículos" });
  }
});
router.post("/abastecimentos", verificarPermissao('Abastecimento'), async (req, res) => {
  try {
    const novoAbastecimento = await DB_Table.Abastecendo.create(req.body);
    res.status(201).json(novoAbastecimento);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar abastecimento", details: error.message });
  }
});
router.get("/all/abastecimentos", verificarPermissao("Administrador", 'Abastecimento'), async (req, res) => {
  try {
    const abastecimentos = await DB_Table.Abastecendo.findAll();
    res.status(200).json(abastecimentos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar abastecimentos", details: error.message });
  }
});
router.post("/entregas", verificarPermissao("Regular","Administrador", 'Bilhetes'), upload.single("imagem"), async (req, res) => {
  try {
    const {
      nomeDestinatario,
      bi,
      numeroDestinatario,
      numeroRemetente,
      tipoCarga,
      agenciaEntregaProvincia,
      agenciaEntregaMunicipio,
      agenciaBuscaProvincia,
      agenciaBuscaMunicipio,
      descricao,
      peso,
      status,
      idUser,
    } = req.body;

    if (
      !nomeDestinatario ||
      !bi ||
      !numeroDestinatario ||
      !numeroRemetente ||
      !tipoCarga ||
      !agenciaEntregaProvincia ||
      !agenciaEntregaMunicipio ||
      !agenciaBuscaProvincia ||
      !agenciaBuscaMunicipio ||
      !descricao ||
      !peso ||
      !idUser
    ) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
    }

    const statusFinal = status || "Pendente";

    const imagemPath = req.file.filename

    const novaEntrega = await DB_Table.Entrega.create({
      nomeDestinatario,
      bi,
      numeroDestinatario,
      numeroRemetente,
      tipoCarga,
      agenciaEntregaProvincia,
      agenciaEntregaMunicipio,
      agenciaBuscaProvincia,
      agenciaBuscaMunicipio,
      descricao,
      peso,
      imagem: imagemPath, 
      status: statusFinal,
      idUser,
    });


    res.status(201).json({
      message: "Entrega registrada com sucesso!",
      entrega: novaEntrega,
    });
  } catch (error) {
    console.error(" Erro ao registrar entrega:", error);
    res.status(500).json({ error: "Erro ao registrar entrega", details: error.message });
  }
});
router.post('/add/manutencao', verificarPermissao('Oficina', "Administrador"), async (req, res) => {
  try {
    const novaManutencao = await DB_Table.Manutencao.create(req.body);
    res.status(201).json(novaManutencao);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.get('/manutencao', verificarPermissao('Oficina', "Administrador"), async (req, res) => {
  try {
    const manutencoes = await DB_Table.Manutencao.findAll();
    res.json(manutencoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/all/entregas", verificarPermissao("Administrador", "Plantao",'Bilhetes'), async (req, res) => {
  try {
    const entregas = await DB_Table.Entrega.findAll({
      order: [["createdAt", "DESC"]],
      where: { 'status': 'Pendente' }
    });

    const entregasFormatadas = entregas.map((entrega) => ({
      ...entrega.toJSON(),
      imagem: entrega.imagem ? `http://localhost:5000/uploads/${entrega.imagem}` : null, // Ajuste conforme a URL do seu servidor
    }));

    res.status(200).json(entregasFormatadas);
  } catch (error) {
    console.error(" Erro ao listar entregas:", error);
    res.status(500).json({ error: "Erro ao listar entregas", details: error.message });
  }
});
router.post("/all/entregas", verificarPermissao("Regular", "Plantao",'Bilhetes'), async (req, res) => {
  try {
    const { idUser } = req.body
    const entregas = await DB_Table.Entrega.findAll({
      order: [["createdAt", "DESC"]], where: { idUser },
    });


    const entregasFormatadas = entregas.map((entrega) => ({
      ...entrega.toJSON(),
      imagem: entrega.imagem ? `http://localhost:5000/uploads/${entrega.imagem}` : null, // Ajuste conforme a URL do seu servidor
    }));

    res.status(200).json(entregasFormatadas);
  } catch (error) {
    console.error(" Erro ao listar entregas:", error);
    res.status(500).json({ error: "Erro ao listar entregas", details: error.message });
  }
});
router.post("/user", verificarPermissao("Regular", 'Administrador','Oficina', 'Abastecimento', 'Plantao', 'Armazem'), async (req, res) => {
    try {
      const { id } = req.body
      const response = await DB_Table.User.findOne({
        where: { id },
      });

      res.status(200).json(response);
    } catch (error) {
      console.error(" Erro ao obter dados do user:", error);
      res.status(500).json({ error: "Erro ao obter dados do user", details: error.message });
    }
});
router.put("/user", verificarPermissao("Regular"), upload.single('imagem'), async (req, res) => {
 

  console.log('Imagem recebida no backend:', req.file);
  const { userId, nome, email, contacto, provincia, municipio } = req.body;

  let nomeDaImagem = req.file ? req.file.filename : null;
  console.log('Nome da imagem:', nomeDaImagem || 'Nenhuma imagem enviada');

  try {
    const user = await DB_Table.User.findOne({ where: { 'id': userId } });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    user.nome = nome;
    user.email = email;
    user.contacto = contacto;
    if (req.file) {
      user.imagem = nomeDaImagem;
    }
    user.provincia = provincia;
    user.municipio = municipio;

    await user.save();

    return res.status(200).json({
      message: 'Dados do usuário atualizados com sucesso!',
      user: {
        userId: user.id,
        nome: user.nome,
        email: user.email,
        contacto: user.contacto,
        imagem: user.imagem,
        provincia: user.provincia,
        municipio: user.municipio,
      },
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
router.post('/register/users', verificarPermissao("Administrador"), upload.single('imagem'), async (req, res) => {
  try {
    const { nome, email, password, tipo } = req.body;


    if (!nome || !email || !tipo || !password) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
    }


    const existingUser = await DB_Table.User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }
    const imagemNAme = req.file ? req.file.filename : null;


    const hashedPassword = await bcrypt.hash(password, 10);


    const newUser = await DB_Table.User.create({
      nome,
      email,
      password: hashedPassword,
      tipo: tipo,
      imagem: imagemNAme
    });

    return res.status(201).json({ message: "Usuário cadastrado com sucesso!", user: newUser });

  } catch (error) {
    console.error("sjsj" + error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});
router.post("/requerir", async (req, res) => {
  try {
    const { requerente, departamento, materiais, detalhes } = req.body;

    let materiaisArray;
    try {
      materiaisArray = typeof materiais === "string" ? JSON.parse(materiais) : materiais;
    } catch (error) {
      return res.status(400).json({ error: "Formato inválido para materiais." });
    }
    let departamentoss
    try {
      departamentoss = await DB_Table.Departamento.findOne({ where: { 'nome': departamento } });


    } catch (error) {
      console.log(error)
    }


    //  Valida se materiais foram enviados corretamente
    if (!materiaisArray || !Array.isArray(materiaisArray) || materiaisArray.length === 0) {
      return res.status(400).json({ error: "Lista de materiais inválida." });
    }

    //  Criando a requisição
    const novaRequisicao = await DB_Table.Requisicao.create({
      requerente,
      departamentoId: departamentoss.id,
      materiais: materiaisArray, // Agora é um array válido
      detalhes,
    });

    res.status(201).json({ message: "Requisição criada com sucesso!", requisicao: novaRequisicao });
  } catch (error) {
    console.error("Erro ao criar requisição:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});
router.get("/reqs", verificarPermissao("Administrador", "Armazem"), async (req, res) => {
  try {
    const reqs = await DB_Table.Requisicao.findAll({
      include: [
        {
          model: DB_Table.Departamento,
          attributes: ["nome"], // Traz apenas o nome do departamento
        }
      ]
    });

    res.status(200).json(reqs);
  } catch (error) {
    console.error("Erro ao buscar reqs:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});
router.put("/reqs/:id",verificarPermissao("Administrador", "Armazem"),
  async (req, res) => {
    try {
      const reqs = await DB_Table.Requisicao.findByPk(req.params.id);
      if (!reqs) {
        return res.status(404).json({ error: "Requisição não encontrada" });
      }

      const origMateriais = reqs.materiais;       
      const atendidos = [];                         
      const pendentes = [];                        
      const mensagensEsgotados = [];

      // Busca tudo de uma vez
      const dbMateriais = await Promise.all(
        origMateriais.map(item =>
          DB_Table.Material.findOne({ where: { nome: item.nome } })
        )
      );

      for (let i = 0; i < origMateriais.length; i++) {
        const pedido = origMateriais[i];
        const matDB = dbMateriais[i];

        if (!matDB) {
          return res
            .status(400)
            .json({ error: `Material não encontrado: ${pedido.nome}` });
        }

        
        if (matDB.quantidade === 0) {
          pendentes.push({ nome: pedido.nome, quantidade: pedido.quantidade });
          mensagensEsgotados.push(
            `Material '${pedido.nome}' sem estoque: ${pedido.quantidade} pendente.`
          );
          continue;
        }

        const podeAtender = Math.min(matDB.quantidade, pedido.quantidade);
        atendidos.push({ nome: pedido.nome, quantidade: podeAtender });

        const sobra = pedido.quantidade - podeAtender;
        if (sobra > 0) {
          pendentes.push({ nome: pedido.nome, quantidade: sobra });
          mensagensEsgotados.push(
            `Material '${pedido.nome}' atendido em ${podeAtender}. ${sobra} pendente.`
          );
        }

      
        await matDB.update({ quantidade: matDB.quantidade - podeAtender });
      }

      await reqs.update({
        atendidos,                    
        materiais: pendentes,         
        status: pendentes.length > 0
          ? "Em andamento"
          : "Aprovado",
      });

      const mensagemFinal =
        pendentes.length > 0
          ? "Requisição aprovada parcialmente. " + mensagensEsgotados.join(" ")
          : "Requisição aprovada completamente.";

      return res
        .status(pendentes.length > 0 ? 206 : 200)
        .json({ message: mensagemFinal, requisicao: reqs });
    } catch (error) {
      console.error("Erro ao atualizar requisição:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);
router.put("/reqs/no/:id", verificarPermissao("Administrador", "Armazem"), async (req, res) => {

  try {
    const reqs = await DB_Table.Requisicao.findOne({ where: { 'id': req.params.id } });

    if (!reqs) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await reqs.update({ status: 'Rejeitado' });

    return res.status(200).json({
      message: 'Dados do usuário atualizados com sucesso!',
      'req': reqs
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
router.put("/reqs/on/:id", verificarPermissao("Administrador", "Armazem"), async (req, res) => {

  try {
    const reqs = await DB_Table.Requisicao.findOne({ where: { 'id': req.params.id } });

    if (!reqs) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await reqs.update({ status: 'Em andamento' });
    return res.status(200).json({
      message: 'Dados do usuário atualizados com sucesso!',
      reqz: reqs
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
router.get("/departamentos", async (req, res) => {
  try {
    const departamentos = await DB_Table.Departamento.findAll();
    res.status(200).json(departamentos);
  } catch (error) {
    console.error("Erro ao buscar departamentos:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});
router.get("/material", verificarPermissao('Administrador',
  'Oficina', 'Abastecimento', 'Plantao', 'Armazem','Bilhetes'), async (req, res) => {
    try {
      const material = await DB_Table.Material.findAll();
      res.status(200).json(material);
    } catch (error) {
      console.error("Erro ao buscar material:", error);
      res.status(500).json({ error: "Erro interno no servidor." });
    }
  });
router.post("/material", verificarPermissao('Administrador', 'Armazem'), async (req, res) => {
  try {
    const { nome, quantidade, descricao } = req.body;

    if (!nome || quantidade == null) {
      return res.status(400).json({ error: "Nome e quantidade são obrigatórios." });
    }

    const material = await DB_Table.Material.create({
      nome,
      quantidade,
      descricao,
    });

    res.status(201).json(material);
  } catch (error) {
    console.error("Erro ao cadastrar material:", error);
    res.status(500).json({ error: "Erro interno ao cadastrar material." });
  }
});
router.put("/material/estoque", verificarPermissao("Administrador", "Armazem"), async (req, res) => {
  try {
    const { id, quantidade } = req.body;
    console.log(id)
    console.log(quantidade)
    if (!id || quantidade == null || quantidade <= 0) {
      return res.status(400).json({ error: "ID e quantidade válidos são obrigatórios." });
    }

    const material = await DB_Table.Material.findByPk(id);
    if (!material) {
      return res.status(404).json({ error: "Material não encontrado." });
    }
    const MAX_INT = 2147483647;
    if (material.quantidade + quantidade > MAX_INT) {
      return res.status(400).json({ error: "Estoque atingiu o valor máximo permitido." });
    }
    material.quantidade += quantidade;

    await material.save();

    res.status(200).json({
      message: "Estoque atualizado com sucesso.",
      material,
    });
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    res.status(500).json({ error: "Erro interno ao atualizar o estoque." });
  }
});
router.post('/viagens', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const { destino, idViatura } = req.body;
    if (!destino) return res.status(400).json({ error: 'Destino é obrigatório.' });
    const novaViagem = await DB_Table.Viagem.create({ destino, idViatura });
    return res.status(201).json(novaViagem);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/viagens', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const viagens = await DB_Table.Viagem.findAll();
    return res.status(200).json(viagens);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.put('/viagens/:id', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const { destino, idViatura } = req.body;
    const viagem = await DB_Table.Viagem.findByPk(req.params.id);
    if (!viagem) return res.status(404).json({ error: 'Viagem não encontrada.' });
    viagem.destino = destino || viagem.destino;
    viagem.idViatura = idViatura || viagem.idViatura;
    await viagem.save();
    return res.status(200).json(viagem);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.delete('/viagens/:id', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const viagem = await DB_Table.Viagem.findByPk(req.params.id);
    if (!viagem) return res.status(404).json({ error: 'Viagem não encontrada.' });
    await viagem.destroy();
    return res.status(200).json({ message: 'Viagem removida com sucesso.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.post('/passageiros', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const { nome, bi, contacto, idViagem, ficarPeloCaminho = false } = req.body;

    if (!nome || !bi || !contacto || !idViagem) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const viagem = await DB_Table.Viagem.findByPk(idViagem);
    const viagemini = await DB_Table.Bilhete.findOne({ where: { "idViagem": viagem.id } });
    if (!viagem) return res.status(404).json({ error: 'Viagem não encontrada.' });

    const novoPassageiro = await DB_Table.Passageiro.create({
      nome,
      bi,
      contacto,
      idViagem,
      idBilhete: viagemini.id,
      ficarPeloCaminho
    });

    return res.status(201).json(novoPassageiro);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/passageiros', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const passageiros = await DB_Table.Passageiro.findAll({
      include: [
        {
          model: DB_Table.Bilhete,
          as: 'bilhete',
          attributes: ['tipoBilhete', 'dataPartida'],
          include: [
            {
              model: DB_Table.Viagem,
              as: 'viagem',
              attributes: ['destino']
            }
          ]
        }
      ],
      where: { 'BilheteUse': 'Não Usado', }
    });


    return res.status(200).json(passageiros);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.delete('/passageiros/:id', verificarPermissao("Administrador", "Plantao", "Bilhetes"), async (req, res) => {
  try {
    const passageiro = await DB_Table.Passageiro.findByPk(req.params.id);
    if (!passageiro) return res.status(404).json({ error: 'Passageiro não encontrado.' });

    const idBilhete = passageiro.idBilhete;

    await passageiro.destroy();

    const bilhete = await DB_Table.Bilhete.findByPk(idBilhete);
    if (!bilhete) return res.status(404).json({ error: 'Bilhete não encontrado.' });

    const novoVendido = bilhete.vendidos - 1;

    await bilhete.update({ vendidos: novoVendido });

    return res.status(200).json({ message: 'Passageiro removido e bilhete atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar passageiro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});
router.post('/bilhetes', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const { idViagem, tipoBilhete, horario, preco, dataPartida, vendidos, validoAte, contatoAgencia, maxPessoas } = req.body;
    console.log(idViagem, tipoBilhete, preco, dataPartida, validoAte, contatoAgencia, maxPessoas)
    if (!idViagem || !tipoBilhete || !horario || !preco || !dataPartida || !validoAte || !contatoAgencia) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios: idViagem, tipoBilhete, preco, dataPartida, validoAte, contatoAgencia.' });
    }

    const viagem = await DB_Table.Viagem.findByPk(idViagem);
    if (!viagem) {
      return res.status(404).json({ error: 'Viagem não encontrada.' });
    }

    const bilhete = await DB_Table.Bilhete.create({
      idViagem,
      tipoBilhete,
      preco,
      vendidos,
      horario,
      dataPartida,
      validoAte,
      contatoAgencia,
      maxPessoas,
      status: 'Disponível'
    });

    const bilhetez = await DB_Table.Bilhete.findAll({
      include: [
        {
          model: DB_Table.Viagem,
          as: 'viagem',
          attributes: ['destino'],
        }
      ]
    });
    return res.status(201).json(bilhetez);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.post('/bilhetes/comprar', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const { nome, bi, contacto, idViagem } = req.body;
    if (!nome || !bi || !contacto || !idViagem)
      return res.status(400).json({ error: 'Campos obrigatórios: nome, bi, contacto, idViagem' });

    const viagem = await DB_Table.Viagem.findByPk(idViagem);
    if (!viagem) return res.status(404).json({ error: 'Viagem não encontrada.' });

    const bilhete = await DB_Table.Bilhete.findOne({
      where: { idViagem, status: 'Disponível' }
    });
    if (!bilhete) return res.status(404).json({ error: 'Nenhum bilhete disponível.' });

    if (new Date() > new Date(bilhete.validoAte))
      return res.status(400).json({ error: 'Bilhete expirado.' });

    await DB_Table.Passageiro.create({
      nome,
      bi,
      contacto,
      idViagem,
      idBilhete: bilhete.id
    });

    bilhete.vendidos = (bilhete.vendidos || 0) + 1;
    await bilhete.save();

    viagem.vendidos = (viagem.vendidos || 0) + 1;
    await viagem.save();

    return res.status(201).json({ message: 'Bilhete comprado com sucesso!' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/bilhetes', verificarPermissao("Administrador", "Plantao", 'Regular', 'Bilhetes'), async (req, res) => {
  try {
    const bilhetes = await DB_Table.Bilhete.findAll({
      include: [
        {
          model: DB_Table.Viagem,
          as: 'viagem',
          attributes: ['id', 'destino'],
        },
        {
          model: DB_Table.Passageiro,
          as: 'passageiros',
          attributes: ['nome', 'bi', 'contacto']
        }
      ]
    });
    return res.status(200).json(bilhetes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.post('/reservas', verificarPermissao("Administrador", "Plantao", "Regular"), async (req, res) => {
  try {
    const { nome, bi, contacto, idBilhete, codigoReserva } = req.body;
    const mail = await DB_Table.User.findByPk(req.user.id)
    if (!nome || !bi || !contacto || !idBilhete || !codigoReserva) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios: nome, bi, contacto, email, idViagem, codigoReserva.' });
    }

    const viagem = await DB_Table.Bilhete.findByPk(idBilhete);
    if (!viagem) {
      return res.status(404).json({ error: 'Bilhete não encontrada.' });
    }
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: mail.email,
      subject: 'Reserva de viagens Ango-Real',
      text: `Saudações, o senhor/a ${mail.nome}, fez uma reserva em nome de ${nome}.`,
      html: `
    <h2>Ango-Real</h2>
    <p><strong>Saudações</strong>, o senhor/a ${mail.nome}, 
    acabou de efectuar uma reserva de viagem em nome do senhor/a ${nome}.
    Caso não tenha sido o senhor, não hesite em nos contactar.</p>
  `  };
    const reserva = await DB_Table.Reserva.create({
      nome,
      bi,
      contacto,
      idBilhete,
      codigoReserva,
      user: req.user.id
    });

    sendEmail(mailOptions)
      .then(() => {
        console.log('E-mail enviado com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao enviar e-mail:', error);
      });
    return res.status(201).json({ message: "Reserva criada com sucesso", reserva });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/reservas/user', verificarPermissao("Administrador", "Regular", 'Bilhetes'), async (req, res) => {
  try {
    const reservas = await DB_Table.Reserva.findAll({
      where: {user: req.user.id },
      include: [
        {
          model: DB_Table.Bilhete,
          as: 'bilhete',
          include: [
            {
              model: DB_Table.Viagem,
              as: 'viagem',
              attributes: ['destino']
            }
          ]
        }
      ]
    });

    return res.status(200).json(reservas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/reservas', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const reservas = await DB_Table.Reserva.findAll({
      where: { status: 'Reservado' },
      include: [
        {
          model: DB_Table.Bilhete,
          as: 'bilhete',
          include: [
            {
              model: DB_Table.Viagem,
              as: 'viagem',
              attributes: ['destino']  // Aqui é onde incluímos o destino da viagem
            }
          ]
        }
      ]
    });

    return res.status(200).json(reservas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.delete('/reservas/:id', verificarPermissao("Administrador", 'Bilhetes'), async (req, res) => {
  try {
    const reserva = await DB_Table.Reserva.findByPk(req.params.id);
    if (!reserva) return res.status(404).json({ error: "Reserva não encontrada." });
    await reserva.destroy();
    return res.status(200).json({ message: "Reserva removida com sucesso." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.post('/viagens/iniciar', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const { idViagem, passageirosPresentes, entregasPresentes } = req.body;

    if (!idViagem) {
      return res.status(400).json({ error: 'idViagem é obrigatório.' });
    }

    if (
      (!Array.isArray(passageirosPresentes) || passageirosPresentes.length === 0) &&
      (!Array.isArray(entregasPresentes) || entregasPresentes.length === 0)
    ) {
      return res.status(400).json({ error: 'Pelo menos um passageiro ou uma carga deve estar presente.' });
    }


    // Encontre a viagem com seus bilhetes e passageiros
    const viagem = await DB_Table.Viagem.findByPk(idViagem, {
      include: [{
        model: DB_Table.Bilhete,
        as: 'bilhetes',
        include: [{
          model: DB_Table.Passageiro,
          as: 'passageiros'
        }]
      }]
    });

    // Se não encontrar a viagem, retorna erro
    if (!viagem) return res.status(404).json({ error: 'Viagem não encontrada.' });

    // Criando uma nova entrada de viagem iniciada
    const viagemIniciada = await DB_Table.ViagemIniciada.create({
      idViagem, // ID da viagem que está sendo iniciada
      dataInicio: new Date(), // Data e hora da viagem iniciada
      idViatura: viagem.idViatura,
    });

    // Associa a viagem iniciada aos passageiros presentes
    const passageiros = await DB_Table.Passageiro.update(
      {
        BilheteUse: 'Usado',  // Marca os bilhetes como usados
        idViagemIniciada: viagemIniciada.id // Associar a viagem iniciada aos passageiros
      },
      { where: { id: passageirosPresentes } }
    );
    const entrega = await DB_Table.Entrega.update(
      {
        status: 'Em Viagem',
        idViagemIniciada: viagemIniciada.id // Associar a viagem iniciada aos passageiros
      },
      { where: { id: entregasPresentes } }
    );
    // Se nenhum dos dois for encontrado, então sim, dá erro
    if ((passageiros[0] === 0 || !passageiros[0]) && (entrega[0] === 0 || !entrega[0])) {
      return res.status(404).json({ error: 'Nenhum passageiro ou entrega encontrado para atualizar.' });
    }

    return res.status(200).json({ message: 'Viagem iniciada e presenças registradas com sucesso.' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/viagens/iniciadas', async (req, res) => {
  try {
    const viagensIniciadas = await DB_Table.ViagemIniciada.findAll({
      include: [{
        model: DB_Table.Viagem,
        as: 'viagem',
      }],
    });
    return res.status(200).json(viagensIniciadas);
  } catch (error) {
    return res.status(500).json({ erros: error.message });
  }
});
router.put('/viagens/iniciadas/:idViagemIniciada/passenger', async (req, res) => {
  try {
    const { idViagemIniciada } = req.params;
    const { passageiros } = req.body;

    if (!Array.isArray(passageiros) || passageiros.length === 0) {
      return res.status(400).json({ error: 'Lista de passageiros inválida ou vazia.' });
    }

    let atualizados = 0;

    console.log(" ID Viagem Iniciada:", idViagemIniciada);
    console.log(" Passageiros recebidos:", passageiros);

    for (const idPassageiro of passageiros) {
      console.log(` Tentando atualizar Passageiro ID: ${idPassageiro}`);

      // Verifique se o passageiro existe antes de tentar atualizar
      const passageiroExistente = await DB_Table.Passageiro.findOne({
        where: {
          id: idPassageiro,
          idViagemIniciada,
        }
      });

      if (!passageiroExistente) {
        console.log(` Passageiro ID ${idPassageiro} não encontrado ou não pertence à viagem.`);
        continue;
      }

      // Atualizar o passageiro
      const [updated] = await DB_Table.Passageiro.update(
        { desceu: true },
        {
          where: {
            id: idPassageiro,
            idViagemIniciada,
          }
        }
      );

      if (updated > 0) {
        atualizados++;
        console.log(` Passageiro ID ${idPassageiro} marcado como "desceu".`);
      } else {
        console.log(` Passageiro ID ${idPassageiro} não foi atualizado.`);
      }
    }

    if (atualizados === 0) {
      return res.status(404).json({ error: 'Nenhum passageiro foi atualizado.' });
    }

    return res.status(200).json({ message: `${atualizados} passageiro(s) atualizados com sucesso.` });
  } catch (error) {
    console.error(" Erro ao atualizar passageiros:", error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});
router.post('/reservas/comprar', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    console.log("Body recebido:", req.body);
    const { codigoReserva, nome, bi, contacto } = req.body;

    if (!codigoReserva || !nome || !bi || !contacto) {
      return res.status(400).json({ error: 'Campos obrigatórios: codigoReserva, nome, bi, contacto' });
    }

    const reserva = await DB_Table.Reserva.findOne({
      where: { codigoReserva },
      include: {
        model: DB_Table.Bilhete,
        as: 'bilhete',
        include: { model: DB_Table.Viagem, as: 'viagem' }
      }
    });

    if (!reserva)
      return res.status(404).json({ error: 'Reserva não encontrada.' });

    if (reserva.status === 'Comprado')
      return res.status(400).json({ error: 'Reserva já foi usada para compra.' });

    const bilhete = reserva.bilhete;
    if (!bilhete)
      return res.status(404).json({ error: 'Bilhete associado não encontrado.' });

    if (new Date() > new Date(bilhete.validoAte))
      return res.status(400).json({ error: 'Bilhete expirado.' });

    if (bilhete.vendidos >= bilhete.maxPessoas)
      return res.status(400).json({ error: 'Bilhete esgotado.' });

    // Cria o passageiro com os campos obrigatórios
    DB_Table.Passageiro.create({
      nome,
      bi,
      contacto,
      idViagem: bilhete.idViagem,
      idBilhete: bilhete.id,
      ficarPeloCaminho: false,
      BilheteUse: "Não Usado"
    });
    console.log('passa 1');

    // Atualiza o contador de vendidos do bilhete
    bilhete.vendidos = (bilhete.vendidos || 0) + 1;
    bilhete.save();
    console.log('passa 2');

    // Atualiza o status da reserva para "Comprado"
    reserva.status = 'Comprado';
    reserva.save();
    console.log('passa 3');
    const mail = await DB_Table.User.findByPk(reserva.user)
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: mail.email,
      subject: 'Compra de bilhetes de Viagem Ango-Real',
      text: `Saudações senhor/a ${mail.nome}.A sua reserva de id:${reserva.id} foi paga.`,
      html: `
    <h2>Ango-Real</h2>
    <p><strong>Saudações</strong> senhor/a ${mail.nome}. 
    A sua reserva de id:${reserva.id} foi paga.</p>
    <p>Rserva em nome de : ${reserva.nome}.</p>
    <p>Bi: ${reserva.bi}.</p>
    
  `  };

    sendEmail(mailOptions)
      .then(() => {
        console.log('E-mail enviado com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao enviar e-mail:', error);
      });

    return res.status(201).json({
      message: 'Compra realizada com sucesso via reserva',
      reserva,
      // Envia também a viagem se necessário
      viagem: bilhete.viagem
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/passageiros/viagensIn', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const passageiros = await DB_Table.Passageiro.findAll({
      include: [
        {
          model: DB_Table.Bilhete,
          as: 'bilhete',
          attributes: ['tipoBilhete', 'dataPartida'],
          include: [
            {
              model: DB_Table.Viagem,
              as: 'viagem',
              attributes: ['destino']
            }
          ]
        }, {
          model: DB_Table.ViagemIniciada,
          as: 'viagemIniciada',
          attributes: ['status'],
          where: {
            status: 'Em andamento'
          }
        }
      ],
      where: {
        idViagemIniciada: { [Op.not]: null },
        desceu: { [Op.not]: true }
      }
    });


    return res.status(200).json(passageiros);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.put('/passageiro/subir', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  const { passageiroId, idViagemIniciada } = req.body;
  try {
    const passageiro = await DB_Table.Passageiro.findOne({
      where: {
        id: passageiroId,
        idViagemIniciada: null,
      },
    });

    if (!passageiro) {
      return res.status(404).json({ error: 'Passageiro não encontrado ou já está associado a uma viagem.' });
    }

    const viagemIniciada = await DB_Table.ViagemIniciada.findOne({
      where: {
        id: idViagemIniciada,
        status: 'Em andamento',
      },
    });

    if (!viagemIniciada) {
      return res.status(404).json({ error: 'Viagem iniciada não encontrada ou não está em andamento.' });
    }


    const updatedPassageiro = await passageiro.update({
      desceu: false,
      idViagemIniciada: idViagemIniciada,
      BilheteUse: 'Usado',
    });

    return res.status(200).json(updatedPassageiro);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get('/passageiros/re', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  try {
    const passageiros = await DB_Table.Passageiro.findAll({
      include: [
        {
          model: DB_Table.Bilhete,
          as: 'bilhete',
          attributes: ['tipoBilhete', 'dataPartida'],
          include: [
            {
              model: DB_Table.Viagem,
              as: 'viagem',
              attributes: ['destino']
            }
          ]
        }
      ],
    });


    return res.status(200).json(passageiros);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.put("/entregas/aceitar", verificarPermissao("Administrador", 'Bilhetes'), async (req, res) => {
  try {
    const { id, valor } = req.body;


    if (!id) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
    }
    const Entrgas = await DB_Table.Entrega.findByPk(id);
    if (!Entrgas) return res.status(404).json({ error: 'Viagem não encontrada.' });

    Entrgas.status = 'Aceite'
    Entrgas.valor = valor
    await Entrgas.save();
    const mail = await DB_Table.User.findByPk(Entrgas.idUser)
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: mail.email,
      subject: 'Pedido de Envio de carga Ango-Real',
      text: `Saudações senhor/a ${mail.nome}. O seu pedido da entrega foi aceite, com um valor de ${valor}.`,
      html: `
    <h2>Ango-Real</h2>
    <p><strong>Saudações</strong> senhor/a ${mail.nome}. 
    O seu pedido da entrega foi aceite, com um valor de ${valor}kz.</p>
    <p>Descrição da entrega: ${Entrgas.descricao}.</p>
    <p>Tipo de Carga: ${Entrgas.tipoCarga}.</p>
    <p>Destinatário: ${Entrgas.nomeDestinatario}.</p>
    
  `  };

    sendEmail(mailOptions)
      .then(() => {
        console.log('E-mail enviado com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao enviar e-mail:', error);
      });
    res.status(201).json({
      message: "Entrega registrada com sucesso!",
    });
  } catch (error) {
    console.error(" Erro ao registrar entrega:", error);
    res.status(500).json({ error: "Erro ao registrar entrega", details: error.message });
  }
});
router.put("/entregas/negar", verificarPermissao("Administrador", 'Bilhetes'), async (req, res) => {
  try {
    const { id } = req.body;

    console.log(id)
    if (!id) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
    }
    const Entrgas = await DB_Table.Entrega.findByPk(id);
    if (!Entrgas) return res.status(404).json({ error: 'Viagem não encontrada.' });

    Entrgas.status = 'Negado'
    await Entrgas.save();
    const mail = await DB_Table.User.findByPk(Entrgas.idUser)
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: mail.email,
      subject: 'Pedido de Envio de carga Ango-Real',
      text: `Saudações senhor/a ${mail.nome}. O seu pedido da entrega foi negado.`,
      html: `
    <h2>Ango-Real</h2>
    <p><strong>Saudações</strong> senhor/a ${mail.nome}. 
    O seu pedido da entrega foi negado.</p>
    <p>Descrição da entrega: ${Entrgas.descricao}.</p>
    <p>Tipo de Carga: ${Entrgas.tipoCarga}.</p>
    <p>Destinatário: ${Entrgas.nomeDestinatario}.</p>
    
  `  };

    sendEmail(mailOptions)
      .then(() => {
        console.log('E-mail enviado com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao enviar e-mail:', error);
      });
    res.status(201).json({
      message: "Entrega registrada com sucesso!",
    });
  } catch (error) {
    console.error(" Erro ao registrar entrega:", error);
    res.status(500).json({ error: "Erro ao registrar entrega", details: error.message });
  }
});
router.put('/viagens/iniciadas/:idViagemIniciada', async (req, res) => {
  try {
    const { idViagemIniciada } = req.params;
    console.log(idViagemIniciada)
    await Promise.all([ DB_Table.ViagemIniciada.update(
      { status: 'Terminada' },
      {
        where: {
          id: idViagemIniciada,

        }
      }
    ),
    DB_Table.Passageiro.update(
      { desceu: true },
      {
        where: {
          id: idPassageiro,
          idViagemIniciada,
        }
      }
    ),DB_Table.Entrega.update(
      { status: 'Entregue' },
      {
        where: {
          idViagemIniciada,
        }
      }
    )
   ]).then(result => console.log(result)) 
const passageiros = DB_Table.Entrega.findAll(
  {
    where: {
      idViagemIniciada,
      status:'Em Viagem'
    }
  }
)
   for (const idPassageiro of passageiros) {
    console.log(` Tentando atualizar Passageiro ID: ${idPassageiro}`);

    const passageiroExistente = await DB_Table.Entrega.findOne({
      where: {
        id: idPassageiro,
        idViagemIniciada,
      }
    });

    if (!passageiroExistente) {
      console.log(` Entrega ID ${idPassageiro} não encontrado ou não pertence à viagem.`);
      continue;
    }

    const [updated] = await DB_Table.Entrega.update(
      { status: 'Entregue' },
      {
        where: {
          id: idPassageiro,
          idViagemIniciada,
        }
      }
    );
    const mail = await DB_Table.User.findByPk(idPassageiro)
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: mail.email,
      subject: 'Envio de carga Ango-Real',
      text: `Saudações senhor/a ${mail.nome}.A sua carga encontra-se no seu destino.`,
      html: `
    <h2>Ango-Real</h2>
    <p><strong>Saudações</strong> senhor/a ${mail.nome}. 
    A sua carga encontra-se no seu destino.</p>
    <p>Descrição da entrega: ${Entrgas.descricao}.</p>
    <p>Tipo de Carga: ${Entrgas.tipoCarga}.</p>
    <p>Destinatário: ${Entrgas.nomeDestinatario}.</p>
    
  `  };

    sendEmail(mailOptions)
      .then(() => {
        console.log('E-mail enviado com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao enviar e-mail:', error);
      });

    if (updated > 0) {
      atualizados++;
      console.log(` Entrega ID ${idPassageiro} marcado como "desceu".`);
    } else {
      console.log(` Entrega ID ${idPassageiro} não foi atualizado.`);
    }

  }

    return res.status(200).json({ message: ` Viagem Terminada.` });
  } catch (error) {
    console.error(" Erro ao atualizar passageiros:", error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});
router.get("/all/entregas/trips", verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {

    const entregas = await DB_Table.Entrega.findAll({
      order: [['createdAt', 'DESC']],
      where: {
        [Op.or]: [
          { status: 'Aceite' },
          { status: 'Entregue' }
        ]
      }
    });


    const entregasFormatadas = entregas.map((entrega) => ({
      ...entrega.toJSON(),
      imagem: entrega.imagem ? `http://localhost:5000/uploads/${entrega.imagem}` : null, // Ajuste conforme a URL do seu servidor
    }));

    res.status(200).json(entregasFormatadas);
  } catch (error) {
    console.error(" Erro ao listar entregas:", error);
    res.status(500).json({ error: "Erro ao listar entregas", details: error.message });
  }
});
router.get("/all/entregas/trip", verificarPermissao("Administrador", "Plantao"), async (req, res) => {
  try {
    const entregas = await DB_Table.Entrega.findAll({
      order: [["createdAt", "DESC"]],
      where: { 'status': 'Em Viagem' }
    });

    const entregasFormatadas = entregas.map((entrega) => ({
      ...entrega.toJSON(),
      imagem: entrega.imagem ? `http://localhost:5000/uploads/${entrega.imagem}` : null, // Ajuste conforme a URL do seu servidor
    }));

    res.status(200).json(entregasFormatadas);
  } catch (error) {
    console.error(" Erro ao listar entregas:", error);
    res.status(500).json({ error: "Erro ao listar entregas", details: error.message });
  }
});
router.put('/carga/subir', verificarPermissao("Administrador", "Plantao", 'Bilhetes'), async (req, res) => {
  const { passageiroId, idViagemIniciada } = req.body;
  try {
    const passageiro = await DB_Table.Entrega.findOne({
      where: {
        id: passageiroId,
        idViagemIniciada: null,
      },
    });

    if (!passageiro) {
      return res.status(404).json({ error: 'Passageiro não encontrado ou já está associado a uma viagem.' });
    }

    const viagemIniciada = await DB_Table.ViagemIniciada.findOne({
      where: {
        id: idViagemIniciada,
        status: 'Em andamento',
      },
    });

    if (!viagemIniciada) {
      return res.status(404).json({ error: 'Viagem iniciada não encontrada ou não está em andamento.' });
    }

    const updatedPassageiro = await passageiro.update({
      idViagemIniciada: idViagemIniciada,
      status: "Em Viagem"
    });
    const mail = await DB_Table.User.findByPk(passageiro.idUser)
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: mail.email,
      subject: 'Envio de carga Ango-Real',
      text: `Saudações senhor/a ${mail.nome}.A sua carga encontra-se em viagem até o seu destino.`,
      html: `
    <h2>Ango-Real</h2>
    <p><strong>Saudações</strong> senhor/a ${mail.nome}. 
    A sua carga encontra-se em viagem até o seu destino.</p>
    <p>Descrição da entrega: ${Entrgas.descricao}.</p>
    <p>Tipo de Carga: ${Entrgas.tipoCarga}.</p>
    <p>Destinatário: ${Entrgas.nomeDestinatario}.</p>
    
  `  };

    sendEmail(mailOptions)
      .then(() => {
        console.log('E-mail enviado com sucesso!');
      })
      .catch((error) => {
        console.error('Erro ao enviar e-mail:', error);
      });

    return res.status(200).json(updatedPassageiro);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.put('/viagens/iniciadas/:idViagemIniciada/cargas', async (req, res) => {
  try {
    const { idViagemIniciada } = req.params;
    const { passageiros } = req.body;

    if (!Array.isArray(passageiros) || passageiros.length === 0) {
      return res.status(400).json({ error: 'Lista de passageiros inválida ou vazia.' });
    }

    let atualizados = 0;

    console.log(" ID Viagem Iniciada:", idViagemIniciada);
    console.log(" Passageiros recebidos:", passageiros);

    for (const idPassageiro of passageiros) {
      console.log(` Tentando atualizar Passageiro ID: ${idPassageiro}`);

      const passageiroExistente = await DB_Table.Entrega.findOne({
        where: {
          id: idPassageiro,
          idViagemIniciada,
        }
      });

      if (!passageiroExistente) {
        console.log(` Entrega ID ${idPassageiro} não encontrado ou não pertence à viagem.`);
        continue;
      }

      const [updated] = await DB_Table.Entrega.update(
        { status: 'Entregue' },
        {
          where: {
            id: idPassageiro,
            idViagemIniciada,
          }
        }
      );
      const mail = await DB_Table.User.findByPk(idPassageiro)
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: mail.email,
        subject: 'Envio de carga Ango-Real',
        text: `Saudações senhor/a ${mail.nome}.A sua carga encontra-se no seu destino.`,
        html: `
      <h2>Ango-Real</h2>
      <p><strong>Saudações</strong> senhor/a ${mail.nome}. 
      A sua carga encontra-se no seu destino.</p>
      <p>Descrição da entrega: ${Entrgas.descricao}.</p>
      <p>Tipo de Carga: ${Entrgas.tipoCarga}.</p>
      <p>Destinatário: ${Entrgas.nomeDestinatario}.</p>
      
    `  };
  
      sendEmail(mailOptions)
        .then(() => {
          console.log('E-mail enviado com sucesso!');
        })
        .catch((error) => {
          console.error('Erro ao enviar e-mail:', error);
        });

      if (updated > 0) {
        atualizados++;
        console.log(` Entrega ID ${idPassageiro} marcado como "desceu".`);
      } else {
        console.log(` Entrega ID ${idPassageiro} não foi atualizado.`);
      }

    }

    if (atualizados === 0) {
      return res.status(404).json({ error: 'Nenhum Entrega foi atualizado.' });
    }

    return res.status(200).json({ message: `${atualizados} Entrega(s) atualizados com sucesso.` });
  } catch (error) {
    console.error(" Erro ao atualizar Entrega:", error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});
router.put("/pedidos/aceitar", verificarPermissao("Administrador"), async (req, res) => {
  try {
    const { id } = req.body;


    if (!id) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
    }
    const Entrgas = await DB_Table.Requisicao.findByPk(id);
    if (!Entrgas) return res.status(404).json({ error: 'Viagem não encontrada.' });

    Entrgas.status = 'Permitido'
    await Entrgas.save();
  
    res.status(201).json({
      message: "Entrega registrada com sucesso!",
    });
  } catch (error) {
    console.error(" Erro ao registrar entrega:", error);
    res.status(500).json({ error: "Erro ao registrar entrega", details: error.message });
  }
});
router.put("/pedidos/negar", verificarPermissao("Administrador"), async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
    }
    const Entrgas = await DB_Table.Requisicao.findByPk(id);
    if (!Entrgas) return res.status(404).json({ error: 'Viagem não encontrada.' });

    Entrgas.status = 'Rejeitado'
    await Entrgas.save();
  
    res.status(201).json({
      message: "Requisicao registrada com sucesso!",
    });
  } catch (error) {
    console.error(" Erro ao registrar Requisicao:", error);
    res.status(500).json({ error: "Erro ao registrar Requisicao", details: error.message });
  }
});

module.exports = router;