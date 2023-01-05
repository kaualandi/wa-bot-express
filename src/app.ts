import { STATE, create, Client, ContactId } from "@open-wa/wa-automate";
import { Request, Response, Router } from "express";
import options from "./config/options";
require("dotenv").config();

const express = require("express");
const app = express();
app.use(express.json());
const port = process.env.PORT || 80;

const defaultMessage = `Olá, tudo bem ? 😃\n
Ainda não estamos realizando atendimento via Whatsapp por este canal.\n
Caso tenha alguma dúvida, por favor entrar em contato pelo nosso chat, localizado no site. 💬`

const start = async (client: Client) => {
  console.log("\x1b[1;32m✓ USING:", process.env.USING, "\x1b[0m");
  console.log("\x1b[1;32m✓ NUMBER:", await client.getHostNumber(), "\x1b[0m");
  console.log("\x1b[1;32m[SERVER] Servidor iniciado!\x1b[0m");

  client.onStateChanged((state: STATE) => {
    console.log("[Status do cliente]", state);
    if (state === "CONFLICT" || state === "UNLAUNCHED") client.forceRefocus();
  });

  client.onMessage((message) => {
    if (message.body === "!ping") {
      client.sendText(message.from, "pong");
    } else {
      client.sendText(message.from, defaultMessage);
    }
  });

  app.use(client.middleware(true));
  app.listen(port, function () {
    console.log(`\n• Listening on port ${port}!`);
  });

  app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
      worked: true,
      detail: "Servidor funcionando!",
    });
  });

  app.post("/send-text", async (req: Request, res: Response) => {
    const { message, number, image } = req.body;
    if (!message || !number) {
      res.status(400).json({
        worked: false,
        detail: "Parâmetros inválidos! Siga o exemplo abaixo",
        example: {
          message: "Olá, tudo bem?",
          number: "5511999999999",
        },
      });
      return;
    }

    const userHasWA = await client.checkNumberStatus(`${number}@c.us` as ContactId);

    if (userHasWA.status === 404) {
      console.log(`Usuário ${number} não possui WhatsApp!`);
      res.status(400).json({
        worked: false,
        detail: "O número informado não possui WhatsApp!",
        response: userHasWA,
        message,
        number,
      });
      return;
    }

    console.log('userHasWA', userHasWA);

    let sended;

    if (image) {
      sended = await client.sendImage(`${number}@c.us`, image, "image", message);
    } else {
      sended = await client.sendText(`${number}@c.us`, message);
    }

    console.log(sended);
    

    if (!sended.toString().startsWith("true")) {
      console.log(`Erro ao enviar mensagem para ${number}!`);
      res.status(400).json({
        worked: false,
        detail: "Erro ao enviar mensagem!",
        response: sended,
        message,
        number,
      });
    } else {
      console.log(`Mensagem enviada com sucesso para ${number}!`);
      res.status(200).json({
        worked: true,
        detail: "Mensagem enviada com sucesso!",
        response: sended,
        message,
        number,
      });
    }
  });

  return client;
};

create(options(true, start))
  .then((client) => start(client))
  .catch((error) => console.log(error));
