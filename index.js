require('dotenv').config();
const axios = require('axios');
const cheerio =require('cheerio');
const { Client } = require('pg');
const cron = require('node-cron'); 

const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
};

const moedasParaBanco = {
  'PYG': 319,
  'EUR': 13,
  'USD': 2,
  'CLP': 347,
  'BRL': 1,
  'ARS': 10,
  'UYU': 15,
};

function getDataFormatada() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function getDataDeAmanhaFormatada() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const ano = amanha.getFullYear();
  const mes = String(amanha.getMonth() + 1).padStart(2, '0');
  const dia = String(amanha.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// FUNÇÃO ATUALIZADA COM LÓGICA DE UPSERT
async function inserirNoBanco(cotacoesParaInserir) {
  if (cotacoesParaInserir.length === 0) {
    console.log("Nenhuma das moedas de interesse foi encontrada para inserir.");
    return;
  }
  
  console.log(`Iniciando operação de Upsert para ${cotacoesParaInserir.length} cotações no banco de dados...`);
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log("Conectado ao banco de dados com sucesso!");

    const dataCambio = getDataDeAmanhaFormatada();
    const dataHoje = getDataFormatada();

    for (const cotacao of cotacoesParaInserir) {
      const codigoMoeda = moedasParaBanco[cotacao.simbolo];
      const valorStringCorrigido = cotacao.venda.replace(/\./g, '').replace(',', '.');
      const taxaVenda = parseFloat(valorStringCorrigido);

      const query = `
        INSERT INTO moeda_cambio (moeda, datacambio, dtinc, dtalt, valor) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (moeda, datacambio) DO UPDATE SET
          valor = EXCLUDED.valor,
          dtalt = EXCLUDED.dtalt;
      `;
      
      const values = [codigoMoeda, dataCambio, dataHoje, dataHoje, taxaVenda];

      await client.query(query, values);
      console.log(` -> Moeda ${cotacao.simbolo} (código ${codigoMoeda}) processada com valor ${taxaVenda}.`);
    }
    
    console.log("Operação de Upsert no banco de dados concluída com sucesso.");

  } catch (error) {
    console.error('Erro durante a operação com o banco de dados:', error.message);
  } finally {
    await client.end();
    console.log("Conexão com o banco de dados fechada.");
  }
}

async function buscarEInserirCotacoes() {
  const url = "https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas";
  console.log(`\n[${new Date().toLocaleString('pt-BR')}] Executando a busca por cotações...`);
  console.log('Buscando de:', url);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const moedasEncontradas = [];

    $("table tbody tr").each((i, el) => {
      const colunas = $(el).find("td");
      const simbolo = $(colunas[2]).text().trim();
      const compra = $(colunas[3]).text().trim();
      const venda = $(colunas[4]).text().trim();

      if (simbolo && compra && venda) {
        moedasEncontradas.push({ simbolo, compra, venda });
      }
    });

    if (moedasEncontradas.length > 0) {
      console.log(`Sucesso! Encontradas ${moedasEncontradas.length} cotações.`);
      const cotacoesParaBanco = moedasEncontradas.filter(moeda => 
        Object.keys(moedasParaBanco).includes(moeda.simbolo)
      );
      await inserirNoBanco(cotacoesParaBanco);
    } else {
      console.log('Não foram encontradas cotações na página da PTAX.');
    }
  } catch (error) {
    console.error('Erro ao buscar ou processar as cotações da PTAX:', error.message);
  }
}

console.log('Executando a tarefa pela primeira vez ao iniciar...');
buscarEInserirCotacoes();

cron.schedule('30 17 * * *', () => {
  console.log('Disparando a tarefa agendada para as 17:30...');
  buscarEInserirCotacoes();
}, {
  scheduled: true,
  timezone: "America/Sao_Paulo"
});

console.log('Agendador iniciado. O script irá rodar todos os dias às 17:30 (horário de São Paulo).');
console.log('Mantenha este processo em execução. Pressione CTRL+C para parar.');