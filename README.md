# Superlazygit

> ⚠️ Este app foi feito no vibecoding para uso pessoal

App desktop em Electron para abrir um repositório Git local, listar branches, navegar pelos commits e visualizar o patch de cada commit com adições e remoções destacadas.

## Rodando

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Instalador macOS

```bash
npm install
npm run dist
```

Arquivos gerados:

- `release/*.dmg`
- `release/*.zip`

Observacao: para distribuicao final no macOS, o ideal e adicionar assinatura e notarizacao Apple depois. Sem isso, outro Mac ainda pode abrir o app, mas pode exigir confirmacao manual do sistema.

## Fluxo

- Abra `File > Open Repository...`.
- Selecione um repositório Git local.
- Escolha uma branch na primeira coluna.
- Clique em um commit na segunda coluna.
- Veja o diff completo na área principal.
