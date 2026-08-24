# Designações — Reunião de Meio de Semana

Aplicação Flask para receber a programação `.docx`, reconhecer as semanas, manter as partes já designadas e preencher as partes de anciãos/servos conforme as regras da congregação.

## Recursos

- Upload de DOCX.
- Reconhecimento das semanas do modelo S-140-T.
- Leitura do conteúdo que fica dentro de controles do Word.
- Preserva Leitura e toda a sessão Faça Seu Melhor no documento original.
- Pessoas já designadas no documento são consideradas ocupadas naquela semana.
- Nunca usa a mesma pessoa duas vezes na mesma semana.
- Distribuição mensal com alvo de 2–3 designações por pessoa quando possível.
- Presidência: somente anciãos.
- Oração: anciãos/servos.
- Discurso 1: preferência aproximada de 80% anciãos / 20% servos.
- Joias: servos preferencialmente, com José Milton/Edivaldo como exceções.
- Dirigente EBC: anciãos, excluindo José Milton/Edivaldo.
- Leitor EBC: lista própria.
- Indisponibilidade mensal ou semanal.
- Datas sem reunião: celebração, congresso e assembleia.
- Retirar/reativar irmãos sem apagar o cadastro.
- Adicionar novos irmãos.
- Substituição manual com lista filtrada para excluir quem já recebeu designação na semana.
- Validação de conflitos antes do download.
- Exportação em `.docx` modificando `word/document.xml` dentro do arquivo original.

## Teste realizado com o arquivo real

Arquivo:

`NVMC Setembro 2026 (1).docx`

Resultado:

- 5 semanas reconhecidas: 02, 09, 16, 23 e 30 de setembro.
- A semana de 16/09 foi reconhecida com 2 partes de Consideração.
- Nomes da Leitura e das partes de Faça Seu Melhor foram encontrados no XML do documento e preservados.
- Gutemberg Moura foi reconhecido como irmão já designado em Faça Seu Melhor em 30/09 e fica bloqueado para outra parte nessa semana.
- Exportação DOCX testada.
- O arquivo exportado permanece como pacote DOCX.

## Rodar localmente

```bash
python -m venv .venv
```

Windows

```bash
.venv\Scripts\activate
```

Linux/macOS

```bash
source .venv/bin/activate
```

Depois:

```bash
pip install -r requirements.txt
python app.py
```

Abra:

```
http://localhost:10000
```

## Render

1. Suba o conteúdo deste diretório para um repositório GitHub.
2. No Render, crie um Web Service a partir do repositório.
3. O `render.yaml` define build/start e plano free.
4. Após o deploy, abra a URL do serviço.

## Armazenamento

Na primeira versão, cadastro de irmãos, retirados, indisponibilidades e datas sem reunião ficam no `localStorage` do navegador.

O DOCX é processado em memória e não é salvo no servidor.

Para utilização em vários computadores ou por várias pessoas, uma próxima etapa pode adicionar autenticação e PostgreSQL.
