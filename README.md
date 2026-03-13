<p align="center">
  <img src="icon.png" alt="Superlazygit" width="128" />
</p>

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

### "Superlazygit" is damaged and can't be opened

Como o app não possui assinatura Apple, o macOS bloqueia a execução. Para resolver, rode no terminal:

```bash
xattr -cr /Applications/Superlazygit.app
```

Se instalou em outro local, ajuste o caminho. Depois disso o app abre normalmente.

## Fluxo

- Abra `File > Open Repository...`.
- Selecione um repositório Git local.
- Escolha uma branch na primeira coluna.
- Clique em um commit na segunda coluna.
- Veja o diff completo na área principal.
