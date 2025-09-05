const axios = require('axios');
const cheerio = require('cheerio');

// --- CONFIGURAÇÃO ---
const discordWebhookUrl = 'https://discord.com/api/webhooks/1397202263298277376/PdJTv1Dirj-YhBwS3Q30DUELFdD2W0XqxhKNg1li3TXREQ5n4Sad-324_GAgjBLgns5A';

function getDataFormatada() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

async function enviarParaDiscord(todasAsCotacoes, dataConsulta) {
  console.log('Enviando cotações para o Discord...');
  
  const batchSize = 25; 
  let contadorDeLotes = 0;

  for (let i = 0; i < todasAsCotacoes.length; i += batchSize) {
    const lote = todasAsCotacoes.slice(i, i + batchSize);
    contadorDeLotes++;

    const fields = lote.map(moeda => {
      return {
        name: `**${moeda.simbolo}**`,
        value: `Compra: ${moeda.compra}\nVenda: ${moeda.venda}`,
        inline: true
      };
    });

    const payload = {
      embeds: [{
        title: `Cotações PTAX - ${dataConsulta} (Parte ${contadorDeLotes})`,
        color: 5814783,
        fields: fields,
        footer: {
          text: 'Dados fornecidos pelo Banco Central (PTAX)'
        },
        timestamp: new Date().toISOString()
      }]
    };

    try {
      await axios.post(discordWebhookUrl, payload);
      console.log(`Lote ${contadorDeLotes} enviado com sucesso!`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Erro ao enviar o lote ${contadorDeLotes} para o Discord:`, error.message);
    }
  }
}

async function baixarEEnviarCotacoes() {
  const url = "https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas";
  console.log('Baixando cotações de:', url);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const moedasEncontradas = [];

    $("table tbody tr").each((i, el) => {
      const colunas = $(el).find("td");
      const simbolo = $(colunas[0]).text().trim();
      const nome = $(colunas[1]).text().trim();
      const compra = $(colunas[2]).text().trim();
      const venda = $(colunas[3]).text().trim();

      if (simbolo && compra && venda) {
        moedasEncontradas.push({ simbolo, nome, compra, venda });
      }
    });

    if (moedasEncontradas.length > 0) {
      console.log(`Sucesso! Encontradas ${moedasEncontradas.length} cotações.`);
      await enviarParaDiscord(moedasEncontradas, getDataFormatada());
    } else {
      console.log('Não foram encontradas cotações na página da PTAX.');
    }

  } catch (error) {
    console.error('Erro ao baixar ou processar as cotações da PTAX:', error.message);
  }
}

// Inicia o processo
baixarEEnviarCotacoes();
