const axios = require('axios');
require('dotenv').config();

const API_LIST_URL = 'https://api.seven7chat.com/core/v2/api/chats/list';
const TOKEN = process.env.ACCESS_TOKEN;

if (!TOKEN) {
  console.error('Token não definido. Verifique seu arquivo .env e certifique-se de que ACCESS_TOKEN está configurado.');
  process.exit(1);
}

console.log('Token carregado:', TOKEN);

// Dados para a requisição da listagem de chats
const listRequestData = {
  sectorId: '676161c50e7bb7f767099187',
  typeChat: 2,
  status: 2,
  page: 0
};

const headers = {
  'Content-Type': 'application/json',
  'access-token': TOKEN
};

// Corpo do request para finalizar o chat
const finalizeBody = {
  "sendMessageFinalized": true,
  "fidelityUser": false,
  "sendResearchSatisfaction": false
};

async function main() {
  try {
    // Chamada da API para listar os chats
    const listResponse = await axios.post(API_LIST_URL, listRequestData, { headers });
    
    // Extração do array de chats, considerando possíveis estruturas da resposta
    let chats = [];
    if (Array.isArray(listResponse.data)) {
      chats = listResponse.data;
    } else if (Array.isArray(listResponse.data.data)) {
      chats = listResponse.data.data;
    } else if (Array.isArray(listResponse.data.chats)) {
      chats = listResponse.data.chats;
    }

    if (chats.length === 0) {
      console.log("Nenhum chat encontrado.");
      return;
    }

    // Usa o horário atual para calcular a inatividade
    const now = new Date();
    const inatividadeLimite = 30 * 60 * 1000; // 30 minutos em milissegundos

    // Filtra os chats em que a última mensagem foi enviada há mais de 30 minutos
    const filteredChats = chats.filter(chat => {
      if (chat.lastMessage && chat.lastMessage.utcDhMessage) {
        const lastMsgTime = new Date(chat.lastMessage.utcDhMessage);
        return (now - lastMsgTime) > inatividadeLimite;
      }
      return false;
    });

    if (filteredChats.length === 0) {
      console.log('Nenhum chat com mais de 30 minutos encontrado.');
      return;
    }

    console.log(`Foram encontrados ${filteredChats.length} chat(s) com mais de 30 minutos de inatividade.`);
    
    // Itera sobre os chats filtrados para finalizar cada um
    for (const chat of filteredChats) {
      const attendanceId = chat.attendanceId;
      if (!attendanceId) {
        console.log('Chat sem attendanceId, ignorando.');
        continue;
      }
      
      // Monta a URL para finalizar o chat
      const finalizeUrl = `https://api.seven7chat.com/core/v2/api/chats/${attendanceId}/finalize`;
      try {
        const finalizeResponse = await axios.post(finalizeUrl, finalizeBody, { headers });
        console.log(`Chat com Attendance ID: ${attendanceId} finalizado com sucesso.`);
        console.log('Resposta da finalização:', finalizeResponse.data);
      } catch (finalizeError) {
        if (finalizeError.response) {
          console.error(`Erro ao finalizar o chat ${attendanceId}:`, finalizeError.response.status, finalizeError.response.data);
        } else if (finalizeError.request) {
          console.error(`Sem resposta para finalização do chat ${attendanceId}.`);
        } else {
          console.error(`Erro ao configurar requisição para finalizar o chat ${attendanceId}:`, finalizeError.message);
        }
      }
    }
  } catch (error) {
    if (error.response) {
      console.error('Erro na resposta da API de listagem:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Sem resposta da API de listagem. Verifique sua conexão.');
    } else {
      console.error('Erro ao configurar requisição na listagem:', error.message);
    }
  }
}

// Função para agendar a verificação periodicamente
function startScheduler() {
  // Executa imediatamente
  main();
  // Executa a função main a cada 5 minutos (300.000 ms)
  setInterval(() => {
    console.log('Verificando chats inativos...');
    main();
  }, 5 * 60 * 1000);
}

// Inicia o agendador
startScheduler();
