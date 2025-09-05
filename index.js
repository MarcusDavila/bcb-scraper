require('dotenv').config(); // Carrega as variáveis do arquivo .env
const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');

// --- CONFIGURAÇÃO DO BANCO DE DADOS (lido do arquivo .env) ---
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
};

// --- CONFIGURAÇÃO DAS MOEDAS DE INTERESSE ---
// Mapeia o SÍMBOLO da moeda para o CÓDIGO da sua tabela
const moedasParaBanco = {
  'PYG': 319,
  'EUR': 13,
  'USD': 2,
  'CLP': 347,
  'BRL': 1,
  'ARS': 10,
  'UYU': 15,
};

// Retorna a data de HOJE no formato YYYY-MM-DD - porem codigo so pode ser executado as 17hrs pois o ptax eh inserido apos as 13hrs sem horario definido
function getDataFormatada() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Retorna a data de AMANHÃ no formato YYYY-MM-DD, conforme os outros registros desta tabela
function getDataDeAmanhaFormatada() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const ano = amanha.getFullYear();
  const mes = String(amanha.getMonth() + 1).padStart(2, '0');
  const dia = String(amanha.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Função para inserir os dados no banco de dados
async function inserirNoBanco(cotacoesParaInserir) {
  if (cotacoesParaInserir.length === 0) {
    console.log("Nenhuma cotação para inserir no banco de dados.");
    return;
  }
  
  console.log(`Iniciando inserção de ${cotacoesParaInserir.length} cotações no banco de dados...`);
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log("Conectado ao banco de dados com sucesso!");

    const dataCambio = getDataDeAmanhaFormatada();
    const dataHoje = getDataFormatada();

    for (const cotacao of cotacoesParaInserir) {
      const codigoMoeda = moedasParaBanco[cotacao.simbolo];
      // Converte o valor de "123,45" para o número 123.45
      const taxaVenda = parseFloat(cotacao.venda.replace(',', '.'));

      const query = `
        INSERT INTO moeda_cambio (moeda, datacambio, dtinc, dtalt, valor) 
        VALUES ($1, $2, $3, $4, $5)
      `;
      const values = [codigoMoeda, dataCambio, dataHoje, dataHoje, taxaVenda];

      await client.query(query, values);
      console.log(` -> Moeda ${cotacao.simbolo} (código ${codigoMoeda}) inserida com valor ${taxaVenda}.`);
    }
    
    console.log("Todas as cotações foram inseridas com sucesso no banco de dados.");

  } catch (error) {
    console.error('Erro durante a operação com o banco de dados:', error.message);
  } finally {
    await client.end();
    console.log("Conexão com o banco de dados fechada.");
  }
}

// Função principal que orquestra o processo
async function buscarEInserirCotacoes() {
  const url = "https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas";
  console.log('Buscando cotações de:', url);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const moedasEncontradas = [];

    $("table tbody tr").each((i, el) => {
      const colunas = $(el).find("td");
      const simbolo = $(colunas[2]).text().trim();
      const compra = $(colunas[4]).text().trim();
      const venda = $(colunas[5]).text().trim();

      if (simbolo && compra && venda) {
        moedasEncontradas.push({ simbolo, compra, venda });
      }
    });

    if (moedasEncontradas.length > 0) {
      console.log(`Sucesso! Encontradas ${moedasEncontradas.length} cotações.`);

      // Filtra as cotações para pegar apenas as de interesse
      const cotacoesParaBanco = moedasEncontradas.filter(moeda => 
        Object.keys(moedasParaBanco).includes(moeda.simbolo)
      );
      
      // Chama a função para inserir no banco de dados
      await inserirNoBanco(cotacoesParaBanco);

    } else {
      console.log('Não foram encontradas cotações na página da PTAX.');
    }

  } catch (error) {
    console.error('Erro ao buscar ou processar as cotações da PTAX:', error.message);
  }
}

// Inicia o processo
buscarEInserirCotacoes();