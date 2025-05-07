const { DataTypes,Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('./database');



const Carga = sequelize.define('Carga', {
  nome_produto: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  destinatario: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});
const Passageiro = sequelize.define('Passageiro', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  idViagemIniciada: {  
    type: DataTypes.INTEGER,
  },
  bi: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contacto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  idViagem: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Viagems', key: 'id' },
  },
  idBilhete: {
    type: DataTypes.INTEGER,
    references: { model: 'Bilhetes', key: 'id' }, 
  },
  ficarPeloCaminho: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  desceu: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  BilheteUse:{
    type: DataTypes.ENUM("Usado", "Não Usado"),
    defaultValue: "Não Usado",
    allowNull: false,
  }
}, {
  tableName: 'Passageiros',
  timestamps: true,
});
const Reserva = sequelize.define('Reserva', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bi: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contacto: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  idBilhete: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Bilhetes', 
      key: 'id'
    }
  },
    user:{
      type: DataTypes.INTEGER,
      allowNull: false,},
  codigoReserva: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, 
  },
  status: {
    type: DataTypes.ENUM("Reservado", "Comprado"),
    defaultValue: "Reservado"
  }
}, {
  tableName: 'Reservas',
  timestamps: true, 
});

const Bilhete = sequelize.define('Bilhete', {
  idViagem: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'Viagems',
      key: 'id',
    }},
  tipoBilhete: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  vendidos: {
    type: DataTypes.INTEGER, 
    allowNull: true,
  },
  preco: {
    type: DataTypes.INTEGER, 
    allowNull: false,
  },
  dataPartida: {
    type: DataTypes.DATE, 
    allowNull: false,
  },
  validoAte: {
    type: DataTypes.DATE, 
    allowNull: false,
  },
  dataUso: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  horario: {
    type: DataTypes.STRING, 
    allowNull: false,
  },
  contatoAgencia: {
    type: DataTypes.STRING, 
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Disponível', 
  }
}, {
  tableName: 'Bilhetes',
  timestamps: true,
});

const Viagem = sequelize.define('Viagem',{
  destino: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  idViatura: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Viaturas', key: 'id' }, 
  },
},{
  tableName: 'Viagems',
  timestamps: true,
})
const ViagemIniciada = sequelize.define('ViagemIniciada', {
  idViagem: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Viagems',
      key: 'id',
    },
  },
  idViatura: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Viaturas',  
      key: 'id',
    },
  },
  dataInicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Em andamento',
  },
});
ViagemIniciada.hasMany(Passageiro, {
  foreignKey: 'idViagemIniciada',
  as: 'viagemIniciada'
});

Passageiro.belongsTo(ViagemIniciada, {
  foreignKey: 'idViagemIniciada',
  as: 'viagemIniciada'
});





const User = sequelize.define('User', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bi: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contacto: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.ENUM('Regular', 'Administrador', 
      'Oficina', 'Abastecimento', 'Plantao', 'Armazem','Bilhetes'),
    allowNull: false,
  },
  imagem: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  provincia: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  municipio: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});
const Requisicao = sequelize.define("Requisicao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  requerente: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  departamentoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "Departamentos", key: "id" }, 
  },
  atendidos: {
    type: DataTypes.JSON, 
  },
  materiais: {
    type: DataTypes.JSON, 
    allowNull: false,
  },
  detalhes: {
    type: DataTypes.TEXT, 
    allowNull: true,
  },

  status: {
    type: DataTypes.ENUM("Pendente", "Aprovado",'Permitido', "Rejeitado", "Em andamento"),
    defaultValue: "Pendente",
  },
});

const Material = sequelize.define("Material", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  nome: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, 
  },
  quantidade: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

const Departamento = sequelize.define("Departamento", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  nome: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, 
  },
});


const Motorista = sequelize.define('Motorista', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contacto: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  numero_passe: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imagem: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Viatura = sequelize.define("Viatura", {
  matricula: { type: Sequelize.STRING, allowNull: false },
  codigo: { type: Sequelize.STRING, allowNull: false },
  modelo: { type: Sequelize.STRING, allowNull: false },
  modeloId: { type: Sequelize.INTEGER, allowNull: false },
  motoristaId: { type: Sequelize.INTEGER, allowNull: false },
  status: { type: Sequelize.STRING, allowNull: false, defaultValue: "Disponível" }, 
  imagem: { type: Sequelize.STRING, allowNull: true } 
}, {
  tableName: "Viaturas",
  timestamps: true
});


const Marca = sequelize.define('Marca', {
  marca: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Modelo = sequelize.define('Modelo', {
  modelo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Agencia = sequelize.define('Agencia', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Municipio_Agencia = sequelize.define('Municipio_Agencia', {
  municipio: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Provincia_Agencia = sequelize.define('Provincia_Agencia', {
  provincia: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});
const Entrada = sequelize.define('Entrada', {
  dataHora: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  MatriculaVeiculo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  codigoVeiculo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passeMotorista: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passeCobrador: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  kilometragem: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tipoViagem: {
    type: DataTypes.ENUM('normal', 'interprovincial'),
    allowNull: false,
  },
  agencia: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  teveAvaria: {
    type: DataTypes.ENUM('sim', 'nao'),
    allowNull: false,
    defaultValue: 'nao',
  },
  descricaoAvaria: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
});

const Saida = sequelize.define('Saida', {
  dataHora: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  MatriculaVeiculo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  codigoVeiculo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passeMotorista: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  passeCobrador: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '',
  },
  kilometragemFinal: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tipoViagem: {
    type: DataTypes.ENUM('normal', 'interprovincial'),
    allowNull: false,
  },
  agencia: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
});

const Abastecendo = sequelize.define('Abastecimento',{
  dataHora:{
    type:DataTypes.TEXT,
    allowNull:false
  },
  matricula:{
    type:DataTypes.TEXT,
    allowNull:true
  },
  posto:{
    type:DataTypes.TEXT,
    allowNull:true
  },
  combustivel:{
    type:DataTypes.INTEGER,
    allowNull:true
  },
  kilometragem:{
    type:DataTypes.TEXT,
    allowNull:true
  }
})

const Entrega = sequelize.define(
  "Entrega",
  {
    nomeDestinatario: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bi: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    numeroDestinatario: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    idViagemIniciada: { 
      type: DataTypes.INTEGER,
    },
    numeroRemetente: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tipoCarga: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    agenciaEntregaProvincia: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    agenciaEntregaMunicipio: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    agenciaBuscaProvincia: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    agenciaBuscaMunicipio: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    peso: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    imagem: {
      type: DataTypes.TEXT, 
      allowNull: true,
    },
    idUser:{
      type: DataTypes.TEXT,
      allowNull:false,
    },
    valor:{
    type: DataTypes.INTEGER,
    allowNull:true,
  },
    
    status: {
      type: DataTypes.ENUM("Pendente", "Aceite", "Negado", "Em Viagem", "Entregue"),
      allowNull: false,
      defaultValue: "Pendente", 
    },
  },
  {
    tableName: "Entregas",
    timestamps: true,
  }
);

const Manutencao = sequelize.define('Manutencao', {
  
  placa_veiculo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  
  kilometragem: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  
  situacao: {
    type: DataTypes.ENUM('Entrada', 'Em manutenção', 'Em espera', 'Pronto'),
    allowNull: false,
    defaultValue: 'Entrada',
  },
  
  itens: {
    type: DataTypes.JSON,
    allowNull: true,
  }
});

const ViagemInterpro = sequelize.define('ViagemInterpro',{
  destinoFinal:{
    type:DataTypes.TEXT,
    allowNull:false,
  },
  destinoMid:{
    type:DataTypes.JSON,
    allowNull:false,
  },
   
  cargas:{
    type: DataTypes.JSON,
    allowNull: true,
  },
  viatura:{
    type:DataTypes.TEXT,
    allowNull:false,
  },
  estado:{
    type: DataTypes.ENUM('Em Viagem', 'Parada para abastecer', 'Em espera', 'Chegou a agência de destino'),
    allowNull: false,
    defaultValue: 'Em espera',
  },

}) 

Departamento.hasMany(Requisicao, { foreignKey: "departamentoId" });
Requisicao.belongsTo(Departamento, { foreignKey: "departamentoId" });


Requisicao.belongsToMany(Material, { through: "RequisicaoMateriais" });
Material.belongsToMany(Requisicao, { through: "RequisicaoMateriais" });


Carga.belongsTo(Agencia, {
  foreignKey: 'agenciaId',
  as: 'agencia', 
});


Carga.belongsTo(Municipio_Agencia, {
  foreignKey: 'municipioOrigemId',
  as: 'municipioOrigem', 
});


Carga.belongsTo(Municipio_Agencia, {
  foreignKey: 'municipioDestinoId', 
  as: 'municipioDestino'
});


Motorista.hasOne(Viatura, {
  foreignKey: 'motoristaId',
});
Viatura.belongsTo(Motorista, {
  foreignKey: 'motoristaId',
});


Municipio_Agencia.hasMany(Agencia, {
  foreignKey: 'municipioId', 
});
Agencia.belongsTo(Municipio_Agencia, {
  foreignKey: 'municipioId', 
});


Provincia_Agencia.hasMany(Municipio_Agencia, {
  foreignKey: 'provinciaId',
});
Municipio_Agencia.belongsTo(Provincia_Agencia, {
  foreignKey: 'provinciaId',
});


Marca.hasMany(Modelo, {
  foreignKey: 'marcaId',  
  as: 'modelos' 
});

Modelo.belongsTo(Marca, {
  foreignKey: 'marcaId', 
  as: 'marca' 
});


Modelo.hasMany(Viatura, {
  foreignKey: 'modeloId', 
  as: 'viaturas' 
});

Viatura.belongsTo(Modelo, {
  foreignKey: 'modeloId', 
  as: 'modeloViatura' 
});

Viatura.hasMany(Carga, {
  foreignKey: 'viaturaId', 
  as: 'cargas', 
});


Carga.belongsTo(Viatura, {
  foreignKey: 'viaturaId', 
  as: 'viatura', 
});

Agencia.hasMany(Viatura, {
  foreignKey: 'agenciaId',
  as: 'viaturas', 
});


Viatura.belongsTo(Agencia, {
  foreignKey: 'agenciaId',
  as: 'agencia', 
});


Bilhete.belongsTo(Viagem, {
  foreignKey: 'idViagem',
  as: 'viagem'
});
Viagem.hasMany(Bilhete, {
  foreignKey: 'idViagem',
  as: 'bilhetes'
});
Viagem.hasMany(Passageiro, {
  foreignKey: 'idViagem',
  as: 'passageiros',
});

Bilhete.hasMany(Passageiro, {
  as: 'passageiros',
  foreignKey: 'idBilhete',
});
Passageiro.belongsTo(Viagem, {
  foreignKey: 'idViagem',
  as: 'viagem',
});

Passageiro.belongsTo(Bilhete, {
  foreignKey: 'idBilhete',
  as: 'bilhete',
});
Reserva.belongsTo(Bilhete, { as: 'bilhete', foreignKey: 'idBilhete' });



Viagem.hasOne(ViagemIniciada, {
  foreignKey: 'idViagem',
  as: 'viagemIniciada'
});
ViagemIniciada.belongsTo(Viagem, {
  foreignKey: 'idViagem',
  as: 'viagem'
});



/* User.beforeCreate(async (user) => {
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
}); */


module.exports = {
  User,
  Requisicao,
  Departamento,
  Material,
  Entrega,
  Manutencao,
  Carga,
  Abastecendo,
  Motorista,
  Viatura,
  Marca,
  Modelo,
  Agencia,
  Municipio_Agencia,
  Provincia_Agencia,
  Entrada,
  Saida,
  ViagemInterpro,
  Viagem,
  Passageiro,
  Bilhete,
  Reserva,
  ViagemIniciada
};
