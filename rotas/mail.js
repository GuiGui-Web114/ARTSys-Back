const nodemailer = require('nodemailer');
require('dotenv').config();


const transporte = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user:process.env.GMAIL_USER,
    pass:process.env.GMAIL_PASS,     
  },
});


const sendEmail = async (mailoptions) => {
  
  transporte.sendMail(mailoptions, function(error, info){
    if (error) {
      console.log('Erro:', error);
    } else {
      console.log('Email enviado:', info.response);
    }
  });
};

module.exports = sendEmail;
