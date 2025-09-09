 # BCB Scraper

 Este projeto realiza a extração automática de cotações de moedas do site da PTAX/BCB e insere os dados em um banco de dados PostgreSQL. O script executa a coleta diariamente às 17:30 (horário de São Paulo) e pode ser executado manualmente ao iniciar.

 ## Funcionalidades

 - Busca cotações de moedas selecionadas (BRL, USD, EUR, ARS, CLP, UYU, PYG) no site da PTAX.
 - Insere as cotações no banco de dados apenas se ainda não existirem para a data de referência.
 - Agendamento automático diário via `node-cron`.
 - Logs detalhados com data/hora e níveis de severidade.

 ## Tecnologias Utilizadas

 - Node.js
 - Axios
 - Cheerio
 - node-cron
 - PostgreSQL (pg)
 - dotenv

 ## Pré-requisitos

 - Node.js >= 18
 - Banco de dados PostgreSQL

 ## Instalação

 1. Clone este repositório:
	 ```sh
	 git clone https://github.com/MarcusDavila/bcb-scraper.git
	 cd bcb-scraper
	 ```
 2. Instale as dependências:
	 ```sh
	 npm install
	 ```
 3. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
	 ```env
	 DB_USER=seu_usuario
	 DB_PASSWORD=sua_senha
	 DB_HOST=localhost
	 DB_PORT=5432
	 DB_DATABASE=nome_do_banco
	 ```

 ## Execução

 Para rodar o script manualmente:

 ```sh
 node index.js
 ```

 O script executa a coleta ao iniciar e agenda a próxima execução automática para as 17:30 (horário de São Paulo).

 ## Estrutura esperada da tabela no PostgreSQL

 ```sql
 CREATE TABLE moeda_cambio (
	moeda INTEGER NOT NULL,
	datacambio DATE NOT NULL,
	dtinc DATE NOT NULL,
	dtalt DATE NOT NULL,
	valor NUMERIC(18,6) NOT NULL,
	PRIMARY KEY (moeda, datacambio)
 );
 ```

 ## Observações

 - Certifique-se de que o banco de dados esteja acessível e as credenciais estejam corretas no `.env`.
 - O script pode ser executado em servidores ou serviços de background (ex: PM2, Docker, etc).

 ## Licença

 ISC