// populateModelosNHTSA.js
import { Sequelize, DataTypes } from 'sequelize';

// Conexão com o MySQL (usuário root, sem senha, banco "sge")
const sequelize = new Sequelize('mysql://root@localhost:3306/sge');

// Modelo "Marca" (tabela "marca")
const Marca = sequelize.define('Marca', {
  marca: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'marcas',
  freezeTableName: true,
});

// Modelo "Modelo" (tabela "modelo")
const Modelo = sequelize.define('Modelo', {
  modelo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'modelos',
  freezeTableName: true,
});

// Configuração do relacionamento: Uma Marca tem muitos Modelos; cada Modelo pertence a uma Marca.
Marca.hasMany(Modelo, { foreignKey: 'marcaId', as: 'modelos' });
Modelo.belongsTo(Marca, { foreignKey: 'marcaId', as: 'marca' });

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // Opcional: esvazia a tabela de modelos para evitar duplicatas
    await Modelo.destroy({ where: {} });
    console.log("Tabela 'modelo' esvaziada.");

    // Obtém todas as marcas cadastradas na tabela "marca"
    const marcas = await Marca.findAll();
    console.log(`Foram encontradas ${marcas.length} marcas na tabela 'marca'.`);

    // Função para buscar modelos para uma marca pela API da NHTSA
    const fetchModelsForBrand = async (brandName) => {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(brandName)}?format=json`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Erro ao buscar modelos para ${brandName}: ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      return data.Results || [];
    };

    // Para cada marca, obtém os modelos e insere-os na tabela "modelo"
    await Promise.all(marcas.map(async (brand) => {
      try {
        const models = await fetchModelsForBrand(brand.marca);
        if (!models.length) {
          console.log(`Nenhum modelo encontrado para ${brand.marca}.`);
          return;
        }
        // Prepara os dados para inserção: cada modelo é associado à marca pelo campo marcaId
        const modelsToInsert = models.map(m => ({
          modelo: m.Model_Name,
          marcaId: brand.id,
        }));
        await Modelo.bulkCreate(modelsToInsert);
        console.log(`Inseridos ${modelsToInsert.length} modelos para ${brand.marca}.`);
      } catch (err) {
        console.error(`Erro processando a marca ${brand.marca}: ${err.message}`);
      }
    }));

    console.log("Tabela 'modelo' populada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao popular a tabela de modelos:", error);
    process.exit(1);
  }
})();
