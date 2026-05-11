# Camada online minima

Este projeto continua funcionando offline por padrao.

Para sincronizar uma sala numerica entre computadores diferentes, configure Firebase Firestore em `js/online_config.js`.

## O que sincroniza nesta primeira camada

- rodada atual;
- numero sorteado atual;
- historico de numeros sorteados;
- jogadores que ja conferiram a rodada;
- timer compartilhado para a proxima rodada.

As cartelas e marcacoes ainda ficam locais em cada navegador.

## Configuracao

1. Crie um projeto no Firebase.
2. Ative o Firestore Database.
3. Crie um app Web no Firebase.
4. Copie o objeto `firebaseConfig`.
5. Preencha `js/online_config.js`.
6. Troque `enabled` para `true`.

Exemplo:

```js
window.BINGO_ONLINE_CONFIG = {
  enabled: true,
  provider: "firebase",
  sdk_version: "10.14.1",
  room_path: "rooms/sample_room_001",
  firebase_config: {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
  }
};
```

## Regras temporarias para teste fechado

Use regras restritas antes de publicar para publico real.

Para um teste rapido e controlado, voce pode liberar leitura/escrita por tempo limitado no Firestore:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.time < timestamp.date(2026, 6, 1);
    }
  }
}
```

Depois do teste, endureca as regras.
