window.addEventListener("load", function() {
  var Web3 = require("web3");
  var web3 = new Web3("https://rinkeby.infura.io/v3/84e0a3375afd4f57b4753d39188311d7");

  var plus = document.getElementById("add");
  var setAll = document.getElementById("setall");
  var form = document.getElementById("config");
  var keyEl = document.getElementsByName("privkey")[0];

  form.onsubmit = () => {
    sendEth(web3);

    return false;
  };

  keyEl.addEventListener("input", () => {
    key = keyEl.value;
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }
    if (key.length != 66) {
      return
    }

    web3.eth.getTransactionCount(web3.eth.accounts.privateKeyToAccount(`${key}`).address).then(count => {
      document.getElementsByName("nonce")[0].value = count;
    });
  });

  plus.addEventListener("click", () => {
    var row = document.createElement("div");
    row.className = "wallet cards row";
    row.innerHTML = `
      <div class="col-md-6">
      <input type="text" class="card address" placeholder="ETH address (0x012345...)" name="address" required />
      </div>

      <div class="col-md-2">
      <input type="number" class="card amount" placeholder="amount (eth)" name="amount" step="0.00000001" min="0" required />
      </div>

      <div class="col-md-2">
      <input type="number" class="card fee" placeholder="fee (gwei)" name="fee" step="1" min="0" />
      </div>

      <div class="col-md-2 middle">
      <span class="middle">
      ⚙️
      </span>
      </div>
      `;

    document.getElementById("config").insertBefore(row, plus.parentElement.parentElement);

    return false;
  });

  setAll.addEventListener("click", () => {
    var amount = document.getElementById("setall-amount").value;
    var fee = document.getElementById("setall-fee").value;

    var amounts = document.getElementsByClassName("amount");
    var fees = document.getElementsByClassName("fee");

    for (var i = 0; i < amounts.length; i++) {
      amounts[i].value = amount;
      fees[i].value = fee;
    }

    return false;
  });
});

function sendEth(web3) {
  getInputData().then((dataAndOrder) => {
    var data = dataAndOrder[0];
    var order = dataAndOrder[1];

    var confirmations = {};
    if (data.privkey.startsWith("0x")) {
      data.privkey = data.privkey.slice(2);
    }

    var BN = web3.utils.BN;
    var Tx = require('ethereumjs-tx');
    var privateKey = new Buffer(data.privkey, 'hex');

    setWaiting();

    var delay = 0;
    count = parseInt(data.nonce);

    data.transactions.forEach((txn, i, a) => {
      // XXX: to reduce nonce on fail
      window.setTimeout(() => {
        if (web3.utils.isAddress(txn.address)) {
          var tx = new Tx();
          tx.gasPrice = new BN(web3.utils.toWei(txn.fee, "shannon"));
          tx.gasLimit = 21000;
          tx.value = new BN(web3.utils.toWei(txn.amount, "ether"));
          tx.to = txn.address;
          tx.nonce = count++;
          tx.sign(privateKey);

          var serializedTx = tx.serialize();

          confirmations[txn.address] = 0;

          web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            .on('receipt', (r) => {
              console.log(r);
              showReceipt(r, order[txn.address]);
            }).on("error", (e, r) => {
              console.log(e);
              count--;
              showError(e, order[txn.address], r);
            });
        } else {
          document.querySelectorAll("span.middle")[order[txn.address]].innerText = "❌";
          document.querySelectorAll("span.middle")[order[txn.address]].title = `${txn.address} is not a valid Ethereum address!!!!`;
        }
      }, delay++ * 400);
    });
  });
}

function showError(e, order, r) {
  if (!r) {
    document.getElementsByClassName("wallet")[order].lastElementChild.lastElementChild.innerText = "❌";
    document.getElementsByClassName("wallet")[order].lastElementChild.lastElementChild.title = e;
  } else {
    document.getElementsByClassName("wallet")[order].lastElementChild.lastElementChild.innerHTML = `<a rel="noopener" target="_blank" class="receipt" href="https://rinkeby.etherscan.io/tx/${r.transactionHash}">❌</a>`;
  }
}

function showReceipt(r, order) {
  if (r.status) {
    // TODO: change to mainnet
    document.getElementsByClassName("wallet")[order].lastElementChild.lastElementChild.innerHTML = `<a rel="noopener" target="_blank" class="receipt" href="https://rinkeby.etherscan.io/tx/${r.transactionHash}">✅</a>`;
  } else {
    document.getElementsByClassName("wallet")[order].lastElementChild.lastElementChild.innerHTML = `<a rel="noopener" target="_blank" class="receipt" href="https://rinkeby.etherscan.io/tx/${r.transactionHash}">❌</a>`;
  }
}

function setWaiting() {
  document.querySelectorAll("span.middle").forEach(el => {
    el.innerText = "🕟";
  });
}

function getInputData() {
  return new Promise(resolve => {
    var data = new FormData(document.getElementById("config"));
    var parsed = {transactions: []};
    var order = {};
    var txn = {};

    var i = 0;
    for (var pair of data) {
      if (pair[1] == "") {
        continue;
      }

      if (["address", "amount", "fee"].includes(pair[0])) {
        if (pair[0] == "address" && Object.keys(txn).length != 0) {
          parsed.transactions.push(txn);

          order[txn.address] = i++;
          txn = {};
        }

        txn[pair[0]] = pair[1];
      } else {
        parsed[pair[0]] = pair[1];
      }
    }

    parsed.transactions.push(txn);
    order[txn.address] = i++;

    resolve([parsed, order]);
  });
}
