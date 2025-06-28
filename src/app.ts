import { STATE, create, Client, ContactId } from "@open-wa/wa-automate";
import { Request, Response, Router } from "express";

import options from "./config/options";


require("dotenv").config();

const express = require("express");
const app = express();
app.use(express.json());
const port = process.env.PORT || 80;

const start = async (client: Client) => {
  console.log("\x1b[1;32m✓ USING:", process.env.USING, "\x1b[0m");
  console.log("\x1b[1;32m✓ NUMBER:", await client.getHostNumber(), "\x1b[0m");
  console.log("\x1b[1;32m[SERVER] Servidor iniciado!\x1b[0m");

  client.onStateChanged((state: STATE) => {
    console.log("[Status do cliente]", state);
    if (state === "CONFLICT" || state === "UNLAUNCHED") client.forceRefocus();
  });

  client.onMessage(async (message) => {
    console.log("[Mensagem recebida]", message.chatId, message.body);
    if (message.body === "!ping") {
      await client.sendText(message.chatId, "Pong!");
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

    let chatId = '' as ContactId;
    if (number.endsWith("@g.us")) {
      chatId = number;
      console.log(`Número recebido é um grupo: ${number}`);
      const group = await client.getGroupInfo(number);
      console.log(`Informações do grupo: ${JSON.stringify(group)}`);
      if (!group?.title) {
        res.status(400).json({
          worked: false,
          detail: "O número informado é um grupo inválido!",
          response: null,
          message,
          number,
        });
        return;
      }
    } else {
      chatId = `${number}@c.us` as ContactId;
      const userHasWA = await client.checkNumberStatus(chatId);
      if (userHasWA.status === 404) {
        console.log(`Usuário ${chatId} não possui WhatsApp!`);
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
    }


    let sended;

    if (image) {
      sended = await client.sendImage(chatId, image, "image", message);
    } else {
      sended = await client.sendText(chatId, message);
    }

    console.log(sended);
    

    if (!sended.toString().startsWith("true")) {
      console.log(`Erro ao enviar mensagem para ${chatId}!`);
      res.status(400).json({
        worked: false,
        detail: "Erro ao enviar mensagem!",
        response: sended,
        message,
        number,
      });
    } else {
      console.log(`Mensagem enviada com sucesso para ${chatId}!`);
      res.status(200).json({
        worked: true,
        detail: "Mensagem enviada com sucesso!",
        response: sended,
        message,
        number,
      });
    }
  });

  app.get("/groups", async (req: Request, res: Response) => {
    const groups = await client.getAllGroups();
    res.status(200).json({
      worked: true,
      detail: "Grupos obtidos com sucesso!",
      response: groups,
    });
  });

  return client;
};

create(options(true, start))
  .then((client) => start(client))
  .catch((error) => console.log(error));
