#!/bin/bash
cd /home/kavia/workspace/code-generation/real-time-chat-interface-4814-4823/chat_ui_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

