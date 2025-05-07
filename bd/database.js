require('dotenv').config();
const { Sequelize } = require('sequelize');

// Configuração do banco de dados
const sequelize = new Sequelize(
  process.env.DB_NAME,     // Nome do banco de dados
  process.env.DB_USER,     // Usuário do banco de dados
  process.env.DB_PASSWORD, // Senha do banco de dados
  {
    host: process.env.DB_HOST, // Endereço do host (geralmente 'localhost')
    dialect: 'mysql',          // Tipo de banco de dados
  }
);

module.exports = sequelize;
