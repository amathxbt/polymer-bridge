export const NativeBridgeABI = [
  {"type":"function","name":"deposit","inputs":[{"name":"recipient","type":"address"}],"outputs":[],"stateMutability":"payable"},
  {"type":"function","name":"claim","inputs":[{"name":"proof","type":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"liquidity","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"claimedNonces","inputs":[{"name":"","type":"uint256"}],"outputs":[{"name":"","type":"bool"}],"stateMutability":"view"},
  {"type":"event","name":"Deposited","inputs":[{"name":"sender","type":"address","indexed":true},{"name":"recipient","type":"address","indexed":false},{"name":"amount","type":"uint256","indexed":false},{"name":"nonce","type":"uint256","indexed":false},{"name":"destChainId","type":"uint32","indexed":false}],"anonymous":false},
  {"type":"event","name":"Claimed","inputs":[{"name":"recipient","type":"address","indexed":true},{"name":"amount","type":"uint256","indexed":false},{"name":"nonce","type":"uint256","indexed":false},{"name":"srcChainId","type":"uint32","indexed":false},{"name":"srcTxProofHash","type":"bytes32","indexed":true}],"anonymous":false}
] as const;
