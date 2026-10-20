FROM ghcr.io/foundry-rs/foundry:stable

WORKDIR /workspace/contracts
COPY . .

RUN forge build

CMD ["forge", "test"]
