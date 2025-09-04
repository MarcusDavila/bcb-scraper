const axios = require('axios');

// --- CONFIGURAÇÃO ---
const discordWebhookUrl = 'https://discord.com/api/webhooks/1397202263298277376/PdJTv1Dirj-YhBwS3Q30DUELFdD2W0XqxhKNg1li3TXREQ5n4Sad-324_GAgjBLgns5A';

// Função para formatar a data no padrão YYYYMMDD
function getDataFormatada() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}${mes}${dia}`;
}

/**
 * Envia as cotações para o Discord em lotes.
 * @param {Array} todasAsCotacoes - O array com todos os objetos de cotação.
 * @param {string} dataConsulta - A data formatada para o título.
 */
async function enviarParaDiscord(todasAsCotacoes, dataConsulta) {
  console.log('Enviando cotações para o Discord...');
  
  // Discord tem um limite de 25 campos por "Embed". Vamos agrupar as cotações.
  const batchSize = 25; 
  let contadorDeLotes = 0;

  for (let i = 0; i < todasAsCotacoes.length; i += batchSize) {
    const lote = todasAsCotacoes.slice(i, i + batchSize);
    contadorDeLotes++;

    // Cria os campos para a mensagem Embed do Discord
    const fields = lote.map(moeda => {
      return {
        name: `**${moeda.simbolo}**`, // Nome do campo (símbolo da moeda)
        value: `Compra: ${moeda.compra}\nVenda: ${moeda.venda}`, // Valor do campo
        inline: true // Exibe os campos lado a lado
      };
    });

    // Monta o payload completo para o webhook
    const payload = {
      // content: `Segue o lote ${contadorDeLotes}`, // Mensagem de texto simples (opcional)
      embeds: [{
        title: `Cotações do Dia - ${dataConsulta} (Parte ${contadorDeLotes})`,
        color: 5814783, // Uma cor azulada
        fields: fields,
        footer: {
          text: 'Dados fornecidos pelo Banco Central do Brasil'
        },
        timestamp: new Date().toISOString()
      }]
    };

    try {
      // Envia o lote para o webhook
      await axios.post(discordWebhookUrl, payload);
      console.log(`Lote ${contadorDeLotes} enviado com sucesso!`);
      
      // Pequeno delay para não sobrecarregar a API do Discord
      await new Promise(resolve => setTimeout(resolve, 1000)); 

    } catch (error) {
      console.error(`Erro ao enviar o lote ${contadorDeLotes} para o Discord:`, error.message);
    }
  }
}

async function baixarEEnviarCotacoes() {
  const dataArquivo = getDataFormatada();
  const urlCsv = `https://www4.bcb.gov.br/Download/fechamento/${dataArquivo}.csv`;
  
  console.log('Baixando arquivo de cotações de:', urlCsv);

  try {
    const { data } = await axios.get(urlCsv);

    const linhas = data.trim().split('\n');
    const moedasEncontradas = [];

    if (linhas.length < 2) {
      console.log('Não foram encontradas cotações para a data de hoje.');
      return;
    }

    for (let i = 1; i < linhas.length; i++) {
      const colunas = linhas[i].trim().split(';');
      
      const simbolo = colunas[3];
      const taxaCompra = colunas[4];
      const taxaVenda = colunas[5];

      if (simbolo) {
        moedasEncontradas.push({
          simbolo,
          compra: taxaCompra,
          venda: taxaVenda
        });
      }
    }

    if (moedasEncontradas.length > 0) {
      console.log(`Sucesso! Encontradas ${moedasEncontradas.length} cotações.`);
      // Pega a data da primeira linha do CSV para o título
      const dataDaCotacao = linhas[1].split(';')[0]; 
      await enviarParaDiscord(moedasEncontradas, dataDaCotacao);
    } else {
      console.log('O arquivo CSV foi baixado, mas não continha dados de cotação.');
    }

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Erro: Arquivo CSV para a data de hoje (${dataArquivo}.csv) não encontrado.`);
    } else {
      console.error('Ocorreu um erro ao baixar ou processar o arquivo CSV:', error.message);
    }
  }
}

// Inicia o processo
baixarEEnviarCotacoes();