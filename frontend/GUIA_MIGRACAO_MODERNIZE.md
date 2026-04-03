# Documentação e Guia de Migração: Modernize Next.js Template

Este documento serve como um guia passo a passo e uma documentação técnica para criar, configurar e entender a arquitetura do projeto baseado no template "Modernize". Ele foi desenhado para que você tenha total autonomia sobre o código.

---

## 1. Visão Geral do Projeto

O projeto utiliza a stack mais moderna do ecossistema React:
*   **Next.js 15/16 (App Router)**: Framework React para produção, utilizando renderização no servidor (RSC) por padrão.
*   **TypeScript**: JavaScript com tipagem estática para maior segurança.
*   **Material UI (MUI v5/v6)**: Biblioteca de componentes visuais robusta.
*   **Redux Toolkit**: Gerenciamento de estado global (configurações do tema, carrinho de compras, etc.).
*   **Formik & Yup**: Gerenciamento e validação de formulários.
*   **ApexCharts**: Gráficos interativos.

---

## 2. Preparação do Ambiente

Antes de começar, garantimos que as ferramentas básicas estão prontas.

### Pré-requisitos
*   **Node.js (LTS)**: O motor que roda o JavaScript. Versão recomendada: v20+.
    *   *Verifique:* `node -v` no terminal.
*   **VS Code**: Editor de código recomendado.

---

## 3. Criação do Projeto (Passo a Passo)

Vamos criar a estrutura base limpa do Next.js.

### Passo 3.1: Inicializar
No terminal, execute:
```bash
npx create-next-app@latest aqui-lab --empty
```

### Passo 3.2: Configuração Inicial (O "Wizard")
O terminal fará perguntas. Veja o que responder e **porquê**:

1.  **TypeScript?** `Yes` (Essencial para evitar erros de tipo durante o desenvolvimento).
2.  **ESLint?** `Yes` (Mantém o padrão de código e avisa sobre erros).
3.  **Tailwind CSS?** `No` (**Importante**: O Modernize é construído sobre Material UI. Misturar com Tailwind pode gerar conflitos de CSS e aumentar o tamanho do bundle desnecessariamente).
4.  **`src/` directory?** `Yes` (Mantém o código da aplicação separado dos arquivos de configuração na raiz).
5.  **App Router?** `Yes` (A nova arquitetura do Next.js, baseada em Server Components).
6.  **Turbopack?** `Yes` (Compilador mais rápido para desenvolvimento).
7.  **Import alias (@/*)?** `No` (Vamos configurar manualmente depois para incluir a pasta public).

---

## 4. Instalação de Dependências

O template é rico em funcionalidades, o que exige várias bibliotecas.

### O Problema do React 19
O Next.js 15/16 usa React 19 (RC ou Beta). Muitas bibliotecas (como `react-quill` ou `react-big-calendar`) ainda esperam React 18.
**Solução:** Usamos a flag `--legacy-peer-deps` para dizer ao NPM: "Instale mesmo que a versão do React pareça incompatível".

### Comando de Instalação
Copie e rode no terminal dentro da pasta do projeto:

```bash
npm install @mui/material @mui/icons-material @mui/lab @mui/material-nextjs @mui/x-date-pickers @mui/x-tree-view@^6.17.0 @emotion/react @emotion/styled @tabler/icons-react react-redux @reduxjs/toolkit redux-persist formik yup react-quill react-apexcharts apexcharts i18next react-i18next date-fns lodash chance axios simplebar-react react-slick slick-carousel --legacy-peer-deps
```

**Destaques das Dependências:**
*   `@mui/material-nextjs`: Essencial para a integração do MUI com o App Router (evita erros de cache provider).
*   `@emotion/react` e `@emotion/styled`: Motores de estilização do MUI (obrigatórios).
*   `axios`: Cliente HTTP usado pelo template para requisições.
*   `simplebar-react`: Usado para barras de rolagem personalizadas no sidebar.
*   `@mui/x-tree-view@^6.17.0`: Fixamos nesta versão porque a v7 mudou nomes de componentes (ex: `TreeView` virou `SimpleTreeView`), o que quebraria o código do template original.
*   `redux-persist`: Salva o estado (como tema escuro/claro) no LocalStorage do navegador.

### Tipos de Desenvolvimento
```bash
npm install --save-dev @types/lodash @types/chance @types/react-big-calendar --legacy-peer-deps
```

---

## 5. Arquitetura e Migração de Arquivos

Aqui explicamos onde cada peça do quebra-cabeça se encaixa.

### 5.1. A Pasta `public/` (Assets Estáticos)
O Next.js serve arquivos estáticos (imagens, fontes, ícones) a partir desta pasta.
*   **Ação:** Copie todo o conteúdo de `packages/typescript/main/public` do template original para a pasta `public` do seu novo projeto.
*   **Por que?** O código do template faz referências diretas como `/images/profile/user-1.jpg`. Se os arquivos não estiverem lá, o build falha.

### 5.2. A Pasta `src/` (O Código Fonte)
Copie as seguintes pastas do template original para o seu `src/`:

#### A. `src/utils`
*   **O que é:** Utilitários, configurações de tema (`theme/`), internacionalização (`i18n`) e mock data.
*   **Importância:** O arquivo `Theme.tsx` aqui define todas as cores, sombras e tipografia do Material UI.

#### B. `src/store`
*   **O que é:** Configuração do Redux.
*   **Importância:** Controla estados globais como: "O menu lateral está aberto?", "Qual o idioma atual?", "Qual a cor do tema?".

#### C. `src/app/components`
*   **O que é:** Blocos de construção da interface (Gráficos, Tabelas, Cards, Forms).
*   **Dica:** Você pode deletar componentes que não for usar para deixar o projeto mais leve.

#### D. `src/app/(DashboardLayout)`
*   **O que é:** O layout principal do sistema administrativo.
*   **Por que os parênteses `()`?** No Next.js, pastas com parênteses são "Route Groups". Elas não afetam a URL.
    *   `src/app/(DashboardLayout)/page.tsx` -> Acessível em `localhost:3000/`
    *   `src/app/(DashboardLayout)/apps/page.tsx` -> Acessível em `localhost:3000/apps`
    *   Isso permite que tenhamos layouts diferentes (ex: um layout para Login que não tem sidebar, e um layout para Dashboard que tem).

---

## 6. Configurações Críticas (O "Pulo do Gato")

Para ligar tudo isso, precisamos ajustar 3 arquivos principais.

### 6.1. `tsconfig.json` (Caminhos de Importação)
O TypeScript precisa saber onde encontrar os arquivos quando usamos atalhos.

**Edite `compilerOptions.paths`:**
```json
"paths": {
  "@/*": ["./src/*"],
  "/public/*": ["./public/*"] // Permite importar imagens como: import img from "/public/..."
}
```

### 6.2. `src/app/providers.tsx` (A Ponte Client-Side)
O Next.js 15 usa Server Components por padrão. Porém, bibliotecas como `MUI` (estilos) e `Redux` (estado) precisam rodar no navegador (Client Side).
Criamos este componente para "envelopar" nossa aplicação com essas funcionalidades.

**Crie `src/app/providers.tsx`:**
```tsx
"use client"; // Marca este arquivo como Client Component

import React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { ThemeSettings } from '@/utils/theme/Theme';
import '@/utils/i18n'; // Inicializa o sistema de tradução

const ThemeWrapper = ({ children }: { children: React.ReactNode }) => {
  const theme = ThemeSettings();
  return (
    <ThemeProvider theme={theme}>
      {/* CssBaseline: Reseta o CSS do navegador para um padrão consistente */}
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <Provider store={store}>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeWrapper>
            {children}
        </ThemeWrapper>
      </AppRouterCacheProvider>
    </Provider>
  );
};
```

### 6.3. `src/app/layout.tsx` (O Layout Raiz)
Este é o ponto de entrada de todas as páginas.

**Edite `src/app/layout.tsx`:**
```tsx
import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Modernize Dashboard",
  description: "Admin Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Envolvemos tudo com nossos Providers configurados acima */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

---

## 7. Como Personalizar e Expandir

### Migração Incremental (Cherry-Picking)
Você não precisa trazer o template inteiro de uma vez. O Modernize é modular. Se você quer apenas uma página específica ou um conjunto reduzido de funcionalidades, siga esta estratégia:

1.  **Base Obrigatória:** Garanta que você configurou o `src/store`, `src/utils` (especialmente o Theme) e o `src/app/providers.tsx`. Sem isso, os componentes do MUI quebrarão.
2.  **Copie sob Demanda:** Em vez de copiar toda a pasta `src/app/components`, copie apenas o componente que você quer usar (ex: `src/app/components/forms/theme-elements/CustomTextField.tsx`).
3.  **Resolva as Dependências:** Ao copiar um componente, o VS Code vai acusar erros de importação se ele depender de outros arquivos. Siga o rastro e copie apenas o necessário.
4.  **Página Limpa (Sem Layout Admin):** Se você não quer o Sidebar/Header do Dashboard, crie sua página fora do grupo `(DashboardLayout)`.
    *   Exemplo: Crie `src/app/minha-landing/page.tsx`. Ela usará o `RootLayout` (com Theme e Providers), mas não terá a estrutura administrativa visual (Sidebar e Topbar), permitindo que você construa uma tela 100% customizada apenas com os componentes que escolheu.

### Criando uma Nova Página
Para criar uma rota `/minha-pagina`:
1.  Crie a pasta: `src/app/(DashboardLayout)/minha-pagina`
2.  Crie o arquivo: `page.tsx` dentro dela.
```tsx
'use client';
import PageContainer from '@/app/components/container/PageContainer';
import DashboardCard from '@/app/components/shared/DashboardCard';

export default function MinhaPagina() {
  return (
    <PageContainer title="Minha Página" description="Descrição">
      <DashboardCard title="Olá Mundo">
        <p>Conteúdo da minha nova página.</p>
      </DashboardCard>
    </PageContainer>
  );
}
```

### Alterando Cores do Tema
Vá em `src/utils/theme/Theme.tsx`. Lá você encontrará as definições de paleta de cores. O Modernize usa um sistema dinâmico que lê do Redux, mas as cores base estão definidas nos arquivos dentro de `src/utils/theme/`.

### Adicionando Itens ao Menu Lateral
Edite o arquivo `src/app/(DashboardLayout)/layout/vertical/sidebar/MenuItems.ts`.
Cada objeto no array representa um link no menu.

---

## 8. Solução de Problemas (Troubleshooting)

*   **Erro `i18n.changeLanguage is not a function`**:
    *   Significa que o i18n não carregou. Verifique se `import '@/utils/i18n';` está no `providers.tsx`.
*   **Imagens quebradas ou erro de build `/public/...`**:
    *   Verifique se a pasta `public/images` existe na raiz do projeto.
    *   Verifique se o `tsconfig.json` tem o path mapping `/public/*`.
*   **Erro `Module not found: Can't resolve '@emotion/react'`**:
    *   Isso ocorre quando o `@mui/styled-engine` não encontra o Emotion. Certifique-se de que `@emotion/react` e `@emotion/styled` estão instalados. Se persistir, tente deletar `node_modules` e `package-lock.json` e rodar `npm install --legacy-peer-deps` novamente.
*   **Erro `Cannot find module '@mui/material-nextjs/v13-appRouter'`**:
    *   Em versões mais novas do MUI e Next.js, o caminho mudou. Use `v16-appRouter` (para Next.js 16) no arquivo `src/app/providers.tsx`.
*   **Erro de Hydration (Texto diferente no servidor e cliente)**:
    *   Comum com datas ou números randômicos. Use `useEffect` para renderizar esses dados apenas no cliente se necessário.
*   **Erro `Module not found: Can't resolve './NavListing/NavListing'` ou similar**:
    *   Isso acontece se você copiar apenas parte dos arquivos do template. Certifique-se de que todas as pastas em `src/app/(DashboardLayout)/layout/vertical/sidebar` e `src/app/(DashboardLayout)/layout/horizontal/navbar` contenham seus respectivos arquivos `index.tsx` ou `NomeDoComponente.tsx`. Algumas pastas podem parecer vazias se a cópia falhar.
*   **Erro de Hydration com `useMediaQuery` (Sidebar/Layout)**:
    *   O `useMediaQuery` pode retornar valores diferentes no servidor e no cliente, causando erro de "Hydration failed". Para corrigir, use um estado local (`useState`) e `useEffect` para sincronizar o valor apenas após a montagem do componente no cliente. Exemplo:
        ```tsx
        const lgUp = useMediaQuery(...);
        const [isMobile, setIsMobile] = useState(false);
        useEffect(() => setIsMobile(lgUp), [lgUp]);
        // Use !isMobile no lugar de !lgUp
        ```
*   **Erro de Hydration Mismatch no Logo/Sidebar (width mismatch)**:
    *   **Sintoma**: Erro `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` apontando para `style` ou `className` no componente `Logo` ou `Sidebar`.
    *   **Causa**: O estado do Redux (`customizer.isCollapse`) é persistido no `localStorage` via `redux-persist`. O servidor renderiza com o estado padrão (`false`), mas o cliente hidrata com o estado salvo (`true`), causando divergência.
    *   **Solução**: Garanta que a renderização dependente do estado persistido ocorra apenas após a montagem no cliente.
        ```tsx
        // Em Logo.tsx e Sidebar.tsx
        const [mounted, setMounted] = useState(false);
        useEffect(() => setMounted(true), []);
        
        // Use 'mounted' para condicionar o uso do estado persistido
        const width = mounted && customizer.isCollapse ? "40px" : "180px";
        ```
*   **Erro de Hydration Mismatch em Classes CSS (MUI/Emotion)**:
    *   **Sintoma**: Erro `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` mostrando diferenças em `className` (ex: `mui-1rgzlla` vs `mui-1hcovx0`).
    *   **Causa**: Ocorre quando o motor de estilos (Emotion) gera nomes de classes diferentes no servidor e no cliente. Isso geralmente acontece se o `AppRouterCacheProvider` do MUI não estiver configurado corretamente ou se houver múltiplas versões do Emotion instaladas.
    *   **Solução**:
        1.  Certifique-se de que você está usando o `AppRouterCacheProvider` no seu arquivo `src/app/app.tsx` (ou onde você define os providers).
        2.  Verifique se a importação está correta para sua versão do Next.js. Para Next.js 14+, use:
            ```tsx
            import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
            
            // ... dentro do componente
            <AppRouterCacheProvider options={{ enableCssLayer: true }}>
               {/* ... ThemeProvider, etc */}
            </AppRouterCacheProvider>
            ```
        3.  Se o erro persistir, tente limpar o cache do Next.js (`rm -rf .next`) e reinstalar as dependências (`rm -rf node_modules package-lock.json && npm install`).

---

## 9. Rodando o Projeto

```bash
npm run dev
```
Acesse: `http://localhost:3000`

---

Este guia cobre desde a infraestrutura até a criação de novas funcionalidades, garantindo que você tenha controle total sobre o seu projeto Modernize.
