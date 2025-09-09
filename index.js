require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');
const cron = require('node-cron');

// --- APERFEIÇOAMENTO DOS LOGS ---
// Guardamos as funções originais do console para poder usá-las mais tarde.
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

// Função para formatar a data e hora no fuso horário local
const getTimestamp = () => {
  return new Date().toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  });
};

// Sobrescrevemos console.log
console.log = function(...args) {
  const timestamp = getTimestamp();
 
  // O '...args' garante que todos os argumentos originais (ex: console.log('texto', objeto)) sejam passados.
  originalLog(`[${timestamp}] [INFO]:`, ...args);
};

// Fazemos o mesmo para console.error para padronizar os erros
console.error = function(...args) {
  const timestamp = getTimestamp();
  originalError(`[${timestamp}] [ERROR]:`, ...args);
};

// E também para console.warn e console.info, para um log completo
console.warn = function(...args) {
  const timestamp = getTimestamp();
  originalWarn(`[${timestamp}] [WARN]:`, ...args);
};

console.info = function(...args) {
    const timestamp = getTimestamp();
    originalInfo(`[${timestamp}] [INFO]:`, ...args);
};



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


async function inserirNoBanco(cotacoesParaInserir) {
  if (cotacoesParaInserir.length === 0) {
    console.warn("Nenhuma das moedas de interesse foi encontrada para inserir.");
    return;
  }

  console.log(`Iniciando operação de inserção para ${cotacoesParaInserir.length} cotações no banco de dados...`);
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log("Conectado ao banco de dados com sucesso!");

    const dataCambio = getDataDeAmanhaFormatada();
    const dataHoje = getDataFormatada();

    // 1. Consultar moedas que JÁ EXISTEM para a data de amanhã
    const selectQuery = 'SELECT moeda FROM moeda_cambio WHERE datacambio = $1';
    const res = await client.query(selectQuery, [dataCambio]);
    
    // 2. Criar um conjunto (Set) com os códigos das moedas existentes para busca rápida
    const moedasExistentes = new Set(res.rows.map(row => row.moeda));
    console.log(`Encontradas ${moedasExistentes.size} moedas já cadastradas para ${dataCambio}.`);


    for (const cotacao of cotacoesParaInserir) {
      const codigoMoeda = moedasParaBanco[cotacao.simbolo];

      // 3. VERIFICAR se a moeda já existe antes de tentar inserir
      if (moedasExistentes.has(codigoMoeda)) {
        console.log(` -> Moeda ${cotacao.simbolo} (código ${codigoMoeda}) já existe para ${dataCambio}. Pulando inserção.`);
        continue; // Pula para a próxima iteração do loop
      }

      // Se não existe, procede com a inserção
      const valorStringCorrigido = cotacao.venda.replace(/\./g, '').replace(',', '.');
      const taxaVenda = parseFloat(valorStringCorrigido);

      const insertQuery = `
        INSERT INTO moeda_cambio (moeda, datacambio, dtinc, dtalt, valor)
        VALUES ($1, $2, $3, $4, $5);
      `;

      const values = [codigoMoeda, dataCambio, dataHoje, dataHoje, taxaVenda];

      await client.query(insertQuery, values);
      console.log(` -> Moeda ${cotacao.simbolo} (código ${codigoMoeda}) INSERIDA com valor ${taxaVenda}.`);
    }

    console.log("Operação de inserção no banco de dados concluída.");

  } catch (error) {
    console.error('Erro durante a operação com o banco de dados:', error.message);
  } finally {
    await client.end();
    console.log("Conexão com o banco de dados fechada.");
  }
}

async function buscarEInserirCotacoes() {
  const url = "https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas";
 
  console.log("Executando a busca por cotações...");
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
      console.warn('Não foram encontradas cotações na página da PTAX.');
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