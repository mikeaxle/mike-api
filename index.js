// import swagger documentation
const Inert = require("inert");
const Vision = require("vision");
const HapiSwagger = require("hapi-swagger");
const Joi = require("joi");

// import hapi js
const Hapi = require("hapi");

// import ethereum transaction
var Tx = require("ethereumjs-tx");

var BigNumber = require("bignumber.js");

// import web3
var Web3 = require("web3");

// swagger options
const swaggerOptions = {
  info: {
    title: "SMART TOKEN API Documentation",
    version: "1"
  }
};

// network url object
const url = {
  mainnet: "https://mainnet.infura.io/v3/1e14f57075b14a15b7ad54c6ab230ef5",
  rinkeby: "https://rinkeby.infura.io/v3/1e14f57075b14a15b7ad54c6ab230ef5"
};

// init web3 object
const web3 = new Web3(url.rinkeby);

// test address to use
var address = "0x469b6D4bF2A5Bb2c0D86d68bC2806508f06a3ba6";

// contract abi
const abi = require("./abi");

// token contract address
const contractAddress = "0x1dC41cef415C32A63A40DD290c0a11A4df617Cd0";

// contract instance
const contract = new web3.eth.Contract(abi, contractAddress);

// Create a server with a host and port
const server = Hapi.server({
  port: +process.env.PORT,
  host: "0.0.0.0"
  // port: 715
});

// number of decimals
const decimals = 1000000000000000000;

// set api end points
server.route([
  {
    method: "GET",
    path: "/",
    handler: (async = (request, h) => {
      let date = new Date();
      return { started: date, uptime: date.getMilliseconds() };
    })
  },
  {
    /**
     * @endpoint totalSupply
     * @description gets total supply of coins
     */
    method: "GET",
    path: "/totalSupply",
    options: {
      description: "Gets total supply of tokens",
      notes: "returns a string",
      tags: ["api"],
      handler: async (request, h) => {
        // let _tokenId = request.params.starTokenId
        // console.log(_tokenId)

        return contract.methods
          .totalSupply()
          .call()
          .then(totalSupply => {
            return (parseFloat(totalSupply) / decimals).toFixed(2);
          })
          .catch(err => {
            return err;
          });
      }
    }
  },
  {
    /**
     * @endpoint balanceOf
     * @description get balance of address
     */
    method: "GET",
    path: "/balanceOf/{address}",
    options: {
      description: "Get balance of account",
      notes: "returns a string",
      tags: ["api"],
      validate: {
        params: {
          address: Joi.string()
            .required()
            .description("wallet address to get balance of")
        }
      },
      handler: async (request, h) => {
        // get address from request
        let address = request.params.address;

        // get balance of address
        return contract.methods
          .balanceOf(address)
          .call()
          .then(res => {
            return (parseFloat(res.balance) / decimals).toFixed(2);
          })
          .catch(err => {
            return err;
          });
      }
    }
  },
  {
    /**
     * @endpoint transfer
     * @description transfers tokens from one address to another
     */
    method: "POST",
    path: "/transfer/{from}/{to}/{amount}/{privateKey}",
    options: {
      description: "Transfer tokens from one address to another",
      notes: "validation should be done on the front-end",
      tags: ["api"],
      validate: {
        params: {
          to: Joi.string()
            .required()
            .description(`receiver address`),
          from: Joi.string()
            .required()
            .description("sender address"),
          amount: Joi.string()
            .required()
            .description("amount of tokens"),
          privateKey: Joi.string()
            .required()
            .description("sender private key")
        }
      },
      handler: async (request, h) => {
        try {
          // get request params
          let params = {
            to: request.params.to,
            from: request.params.from,
            amount: new BigNumber(request.params.amount * decimals),
            privateKey: new Buffer(request.params.privateKey, "hex"),
            nonce: await web3.eth.getTransactionCount(request.params.from),
            gasPrice: await web3.eth.getGasPrice()
          };

          console.log(params.amount.toString());

          // check if sender has sheets first
          let balance = await contract.methods.balanceOf(params.from).call();
          if (Number(balance.balance) === 0) {
            return `Transaction failed: not enough funds @ address: ${
              params.from
            }`;
          }

          // create data object from transfer method
          let _data = contract.methods
            .transfer(params.to, params.amount.toString())
            .encodeABI();

          // Set up the transaction using the transaction variables
          let rawTransaction = {
            nonce: web3.utils.toHex(params.nonce),
            to: contractAddress,
            from: params.from,
            gasPrice: web3.utils.toHex(params.gasPrice),
            gasLimit: web3.utils.toHex(100000),
            value: web3.utils.toHex(0),
            data: _data
          };

          // create transaction object
          let transaction = new Tx(rawTransaction);

          // Sign the transaction with the Hex value of the private key of the sender
          transaction.sign(params.privateKey);

          // serialize the transaction
          let serializedTransaction = transaction.serialize();

          // Send the serialized signed transaction to the Ethereum network.
          // TODO: replace timeout with messaging queue
          setTimeout(() => {
            return web3.eth
              .sendSignedTransaction(
                "0x" + serializedTransaction.toString("hex")
              )
              .then(result => {
                console.log("Transaction result:");
                console.log(result);
                return `Transaction successful: ${params.from} sent ${
                  request.params.amount
                } to ${params.to}`;
              })
              .catch(err => {
                console.log(err);
              });
          }, 30000);
        } catch (err) {
          console.log(err);
          return err;
        }
      }
    }
  }
]);

// Start the server
async function start() {
  // register modules
  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    }
  ]);

  try {
    await server.start();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
  console.log("Server running at:", server.info.uri);
}

start();
