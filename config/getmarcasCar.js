// getMarcasCar.js
import { Sequelize, DataTypes } from 'sequelize';

// Conexão com o MySQL (usuário root, sem senha, banco "sge")
const sequelize = new Sequelize('mysql://root@localhost:3306/sge');

// Definição do modelo "Marca" com apenas o campo "marca" e tabela nomeada "marca"
const Marca = sequelize.define('Marca', {
  marca: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'marcas',
  freezeTableName: true,
});

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // Usando a API da NHTSA para obter todas as marcas de veículos
    const url = 'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json';
    const response = await fetch(url);
    const jsonData = await response.json();

    // A propriedade "Results" contém um array de marcas
    const makes = jsonData.Results;
    if (!makes) {
      throw new Error("Propriedade 'Results' não encontrada no JSON retornado.");
    }
    console.log(`Foram encontradas ${makes.length} marcas de carros.`);

    // Para cada marca, insere (ou ignora se já existir) utilizando apenas o campo "marca"
    for (const make of makes) {
      const makeName = make.Make_Name;
      await Marca.findOrCreate({
        where: { marca: makeName },
      });
    }

    console.log("Tabela 'marca' populada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao popular a tabela de marcas:", error);
    process.exit(1);
  }
})();
