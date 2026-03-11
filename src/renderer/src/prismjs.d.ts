declare module 'prismjs' {
  interface PrismGrammar {
    [key: string]: unknown;
  }

  interface PrismLanguages {
    [key: string]: PrismGrammar | undefined;
  }

  const Prism: {
    languages: PrismLanguages;
    highlight: (text: string, grammar: PrismGrammar, language: string) => string;
  };

  export default Prism;
}

declare module 'prismjs/components/prism-markup';
declare module 'prismjs/components/prism-css';
declare module 'prismjs/components/prism-clike';
declare module 'prismjs/components/prism-javascript';
declare module 'prismjs/components/prism-jsx';
declare module 'prismjs/components/prism-typescript';
declare module 'prismjs/components/prism-tsx';
declare module 'prismjs/components/prism-json';
declare module 'prismjs/components/prism-csharp';
declare module 'prismjs/components/prism-sql';
declare module 'prismjs/components/prism-yaml';
