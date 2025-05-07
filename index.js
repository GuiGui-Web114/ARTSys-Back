const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const DB_Table = require("./bd/tabels");
const bcrypt = require("bcryptjs");
const userAdminRoutes = require("./rotas/regular/regular");
const sendEmail = require('./rotas/mail');


dotenv.config();

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || "ANGO_real";


app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, origin);
    },
    credentials: true,
  })
);


app.use(express.json()); 
app.use("/uploads", express.static("uploads"));
app.use(cookieParser()); 
app.use(express.urlencoded({ extended: true })); 

/* function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ erro: "Token mal formatado" });
  }
  
  const token = parts[1];
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    console.log(decoded)
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ erro: "Token inválido" });
  }
} */

let userRegistrations = {};

app.post('/register', async (req, res) => {
  try {
    const { nome, email, contacto, bi, password, tipo } = req.body;

  
    if (!nome || !email || !contacto || !bi || !password) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
    }

   
    if (!/^\d{9}[A-Z]{2}\d{3}$/.test(bi)) {
      return res.status(400).json({ error: "Formato de BI inválido." });
    }

   
    const contactoFormatado = contacto.startsWith("+244") ? contacto : `+244${contacto}`;

    if (!/^\+2449\d{8}$/.test(contactoFormatado)) {
      return res.status(400).json({ error: "Número de telefone inválido para Angola." });
    }

/*    
    const biRes = await fetch(`https://angolaapi.onrender.com/api/v1/validate/bi/${bi}`);
    const biData = await biRes.json();
    console.log(biData)
    if (biData.sucess !== true) {
      return res.status(400).json({ error: "BI inválido de acordo com a AngolaAPI." });
    } */

   /*  
    const telRes = await fetch(`https://angolaapi.onrender.com/api/v1/validate/phone/${contactoFormatado}`);
    const telData = await telRes.json();
    if (telData.sucess !== true) {
      return res.status(400).json({ error: "Telefone inválido de acordo com a AngolaAPI." });
    }
 */
    
    const existingUser = await DB_Table.User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

 
 const code = Math.floor(100000 + Math.random() * 900000);


    
    userRegistrations[email] = {
      nome,
      email,
      contacto: contactoFormatado,
      bi,
      password,
      tipo: tipo || 'Regular',
      code,
      expires: Date.now() + 15 * 60 * 1000 
    };

   
    await sendEmaill(email, code);

    return res.status(200).json({ message: "Cadastro iniciado com sucesso! Verifique seu e-mail para o código de verificação." });

  } catch (error) {
    console.error("Erro no registro:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});



app.post('/verificar-email', async (req, res) => {
  const { email, codigo } = req.body;
  const registro = userRegistrations[email];  

  if (!registro) {
    return res.status(400).json({ error: "Nenhum código foi enviado para este e-mail." });
  }

 
  if (Date.now() > registro.expires) {
    delete userRegistrations[email]; 
    return res.status(400).json({ error: "Código expirado. Solicite um novo." });
  }

  if (parseInt(codigo) !== registro.code) {
    return res.status(400).json({ error: "Código inválido." });
  }

  try {
    const hashedPassword = await bcrypt.hash(registro.password, 10);

    const newUser = await DB_Table.User.create({
      nome: registro.nome,
      email: registro.email,
      contacto: registro.contacto,
      bi: registro.bi,
      password: hashedPassword,
      tipo: registro.tipo || 'Regular',
      verificado: true 
    });

    delete userRegistrations[email];

    return res.status(200).json({ message: "E-mail verificado com sucesso! Usuário criado." });

  } catch (error) {
    console.error("Erro ao criar o usuário:", error);
    return res.status(500).json({ error: "Erro ao criar o usuário." });
  }
});



app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const usuario = await DB_Table.User.findOne({ where: { email } });
    if (!usuario) {
      return res.status(400).json({ estado: "falhou", erro: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(password, usuario.password);
    if (!senhaValida) {
      return res.status(400).json({ estado: "falhou", erro: "Senha incorreta" });
    }

   
    const token = jwt.sign({ id: usuario.id, tipo: usuario.tipo }, SECRET_KEY, {
      expiresIn: "10h",
    });

    console.log("Token gerado:", token);


    res.json({
      estado: "sucesso",
      tokeen:token,
      id: usuario.id,
      tipo: usuario.tipo,
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ estado: "falhou", erro: "Erro interno no servidor" });
  }
});


app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ estado: "sucesso", message: "Logout realizado com sucesso!" });
});

const sendEmaill = async (email, code) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Código de Verificação',
    text: `Seu código de verificação é: ${code}`
  };

  try {
    await sendEmail(mailOptions);
    console.log('E-mail enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar o e-mail:', error);
  }
};
/* 
const mailOptions = {
  from: 'guilhermesakanenobernardo@gmail.com',
  to: 'huji83025@gmail.com',
  subject: 'Enviando Email usando Node.js',
  text: 'Isso foi fácil!'
};
 sendEmail(mailOptions)
  .then((response) => {
    console.log('E-mail enviado com sucesso!',response);
  })
  .catch((error) => {
    console.error('Erro ao enviar e-mail:', error);
  }); 
 */

app.use("/admin", userAdminRoutes);
/* 
 DB_Table.Requisicao.sync({ alter: true });
 console.log("Tabttela 'User' atualizada com sucesso.");
 */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
