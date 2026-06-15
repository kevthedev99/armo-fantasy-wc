-- One-time clear of beta chat history (old sponsor-name-only messages).
truncate table public.chat_messages;
