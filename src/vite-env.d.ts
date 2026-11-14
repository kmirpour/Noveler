/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set by `npm run build:web`: the version and build shown in Settings for the hosted web version. */
  readonly VITE_APP_VERSION?: string;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }
  export default function nspell(aff: string, dic: string): NSpell;
}
