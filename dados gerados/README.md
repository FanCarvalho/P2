# Gestão de Iluminação Pública Inteligente

Este projeto utiliza Node.js para gerar dados sintéticos para um sistema de gestão de iluminação pública inteligente. O objetivo é simular um ambiente realista para testar e validar a eficácia de várias estratégias de gestão e manutenção.

## Tecnologias Utilizadas

- **Node.js:** Plataforma de desenvolvimento utilizada para executar o gerador de dados.
- **@faker-js/faker:** Biblioteca para a geração de dados fictícios, permitindo a criação de um conjunto de dados rico e variado.

## Reprodutibilidade

Para garantir que os dados gerados sejam consistentes e que os resultados dos testes possam ser reproduzidos, utilizamos uma semente (seed) fixa no gerador de dados. Isto assegura que, a cada execução, os mesmos dados sejam gerados, facilitando a comparação de resultados e a depuração.

## Entidades

O modelo de dados do projeto é composto pelas seguintes entidades:

- **Sistemas:** Representa os diferentes sistemas de gestão de iluminação implementados.
- **Operadores:** Indivíduos ou equipas responsáveis pela manutenção e operação dos sistemas.
- **Zonas:** Áreas geográficas distintas onde os postes de iluminação estão localizados.
- **Postes:** Pontos de iluminação individuais, cada um com as suas próprias características e estado.
- **Sensores:** Dispositivos instalados nos postes para monitorizar o seu funcionamento e o ambiente circundante.
- **Avarias:** Registos de falhas ou problemas detectados nos postes ou sensores.

## Objetivos e Validação

O principal objetivo deste projeto é validar um conjunto de indicadores de desempenho (KPIs) chave, incluindo:

- **Poupança Energética:** Avaliar a eficiência das estratégias de iluminação, como a regulação da intensidade luminosa baseada na presença de pessoas ou veículos.
- **MTTR (Mean Time To Repair):** Medir o tempo médio para a reparação de avarias, um indicador crucial para a eficiência da equipa de manutenção.

A análise destes indicadores permitirá otimizar a gestão da iluminação pública, resultando em maior eficiência energética e operacional.

## Como Executar

Para executar o projeto e gerar os dados sintéticos, siga os passos abaixo:

1. **Instalar as dependências:**
   Abra o terminal na raiz do projeto e execute o comando para instalar todas as dependências necessárias.

   ```bash
   npm install
   ```

2. **Gerar os dados:**
   Após a instalação das dependências, execute o script de geração de dados. Este comando irá criar o ficheiro `dadosIluminacaoPublica.json` dentro da pasta `data/`.
   ```bash
   npm start
   ```

   #
