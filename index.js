const axios = require("axios");
const axiosThrottle = require("axios-request-throttle");
const Decimal = require("decimal.js-light");
const Duration = require("duration");

const homeSymbol = {
	AVALANCHE: {
		symbol: "USDC",
		address: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
		decimals: 6,
	},
	FANTOM: {
		symbol: "USDC",
		address: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
		decimals: 6,
	},
	POLYGON: {
		symbol: "USDC",
		address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
		decimals: 6,
	},
	// OPTIMISM: {
	// 	symbol: "USDC",
	// 	address: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
	// 	decimals: 6,
	// },
	// OPTIMISM: {
	// 	symbol: "USDT",
	// 	address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
	// 	decimals: 6,
	// },
	OPTIMISM: {
		symbol: "sUSD",
		address: "0x8c6f28f2f1a3c87f0f938b96d27520d9751ec8d9",
		decimals: 6,
	},
	ARBITRUM: {
		symbol: "USDC",
		address: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
		decimals: 6,
	},
	// ARBITRUM: {
	// 	symbol: "USDT",
	// 	address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
	// 	decimals: 6,
	// },
};

const customTokens = {
	AVALANCHE: {
		"0x70928E5B188def72817b7775F0BF6325968e563B": {
			symbol: "LUNA",
			address: "0x70928E5B188def72817b7775F0BF6325968e563B",
			decimals: 6,
		},
	},
};
53.15783;

const bannedProtocols = {
	AVALANCHE: ["BAGUETTE"],
};

const balance = 100;
const requestsPerSecond = 5;
let balanceSimulation = 100;
const minProfitInHomeSymbol = 1;
const verboseLog = false;
const useSandwithArbitrage = false;

// cache
const tokensBySymbol = {};
const tokensByNetwork = {};
const swapPrice = {};
const protocolsByNetwork = {};
let triangleArbitrageRoutes = {};
let sandwitchArbitrageRoutes = {};
const startTime = new Date();

const chains = {
	AVALANCHE: {
		code: 43114,
		symbol: "AVAX",
		address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
		v: "v4.0",
	},
	FANTOM: {
		code: 250,
		symbol: "FTM",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
	ETH: {
		code: 1,
		symbol: "ETH",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
	BSC: {
		code: 56,
		symbol: "BNB",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
	POLYGON: {
		code: 137,
		symbol: "MATIC",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
	OPTIMISM: {
		code: 10,
		symbol: "OPT",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
	ARBITRUM: {
		code: 42161,
		symbol: "ARB",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
	GNOSIS: {
		code: 100,
		symbol: "GNO",
		address: "0x0000000000000000000000000000000000000000",
		v: "v4.0",
	},
};

const networkApiBaseURL = {
	// AVALANCHE: `https://api.1inch.io/${chains.AVALANCHE.v}/${chains.AVALANCHE.code}/`,
	// FANTOM: `https://api.1inch.io/${chains.FANTOM.v}/${chains.FANTOM.code}/`,
	// POLYGON: `https://api.1inch.io/${chains.POLYGON.v}/${chains.POLYGON.code}/`,
	// OPTIMISM: `https://api.1inch.io/${chains.OPTIMISM.v}/${chains.OPTIMISM.code}/`,
	ARBITRUM: `https://api.1inch.io/${chains.ARBITRUM.v}/${chains.ARBITRUM.code}/`,
	// GNOSIS: `https://api.1inch.io/${chains.GNOSIS.v}/${chains.GNOSIS.code}/`,
};
const stepId = ["a", "b", "c", "d"];

// set request limit
axiosThrottle.use(axios, { requestsPerSecond });

const fisherYates = (array) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
};

function toHumanAmount(rawAmount, decimals) {
	const scale = new Decimal(10).pow(decimals);
	const humanAmount = new Decimal(rawAmount).div(scale);
	return humanAmount.toNumber();
}

function toRawAmount(humanAmount, decimals) {
	if (humanAmount !== undefined) {
		const scale = new Decimal(10).pow(decimals);
		const rawAmount = new Decimal(humanAmount).mul(scale);
		return rawAmount.toFixed(0);
	} else {
		return undefined;
	}
}

const storeTokensData = (network, tokens) => {
	for (const token of Object.values(tokens)) {
		// set token obj to tokensBySymbol
		// tokensBySymbol[token.symbol] = {
		// 	...tokensBySymbol[token.symbol],
		// 	[network]: {
		// 		[token.address]: token,
		// 	},
		// };

		// set token obj to tokensByNetwork
		tokensByNetwork[network] = {
			...tokensByNetwork[network],
			[token.address]: token,
		};
	}

	// if (Object.values(customTokens[network])) {
	// 	tokensByNetwork[network] = {
	// 		...tokensByNetwork[network],
	// 		...customTokens[network],
	// 	};
	// }
};

const getAllTokens = async () => {
	try {
		for (const network of Object.keys(networkApiBaseURL)) {
			const response = await axios.get(networkApiBaseURL[network] + "tokens");
			storeTokensData(network, response.data.tokens);
		}
	} catch (error) {
		console.error(error.message);
	}
};

const getAllProtocols = async () => {
	try {
		for (const network of Object.keys(networkApiBaseURL)) {
			const response = await axios.get(networkApiBaseURL[network] + "liquidity-sources");

			let protocols = response.data.protocols.map((p) => p.id);
			protocols = protocols.filter((p) => !bannedProtocols[network].includes(p));
			protocolsByNetwork[network] = protocols.join(",");
		}
	} catch (error) {
		console.error(error.message);
	}
};

const getNativeTokenSwapPrices = async () => {
	try {
		for (const network of Object.keys(networkApiBaseURL)) {
			const response = await axios.get(
				"https://token-prices.1inch.io/v1.1/" + chains[network].code
			);

			const prices = response.data;

			for (const swapPair of Object.keys(swapPrice)) {
				if (swapPair.split("-")[1] === chains[network].symbol) {
					const state = swapPrice[swapPair][network];
					if (state.q === chains[network].address && Object.hasOwnProperty.call(prices, state.b)) {
						swapPrice[swapPair][network] = {
							...state,
							p: prices[state.b],
							timestamp: Date.now(),
						};

						// console.log(swapPrice[swapPair][network]);
					}
				}
			}
		}
	} catch (error) {
		console.error(error.message);
	}
};

const searchForArbitrageRoutes = () => {
	try {
		// loop through all networks
		for (const network of Object.keys(tokensByNetwork)) {
			console.log(`Searching for routes in ${network}`);

			const tempTriangleArbitrageRoutes = [];
			const tempSandwitchArbitrageRoutes = [];

			const tokens = Object.values(tokensByNetwork[network]);
			// const tokensObj = tokensByNetwork[network];

			console.log(tokens[0]);

			// loop through all tokens within a network
			for (const a of tokens) {
				const route = {};

				if (a.address !== homeSymbol[network].address) {
					route.a = {
						bSymbol: a.symbol,
						qSymbol: homeSymbol[network].symbol,
						bAddress: a.address,
						qAddress: homeSymbol[network].address,
					};

					swapPrice[a.symbol + "-" + homeSymbol[network].symbol] = {
						[network]: {
							b: a.address,
							q: homeSymbol[network].address,
							p: "0",
						},
					};

					verboseLog && console.log(`Searching for routes in ${network} for ${a.symbol}`);

					for (const b of tokens) {
						if (b.address !== homeSymbol[network].address && b.address !== a.address) {
							route.b = {
								bSymbol: b.symbol,
								qSymbol: a.symbol,
								bAddress: b.address,
								qAddress: a.address,
							};

							swapPrice[b.symbol + "-" + a.symbol] = {
								[network]: {
									b: b.address,
									q: a.address,
									p: "0",
								},
							};

							// verboseLog &&
							// 	console.log(`🔷 ${a.symbol} -> ${b.symbol} -> ${homeSymbol[network].symbol}`);

							tempTriangleArbitrageRoutes.push({
								...route,
								c: {
									bSymbol: homeSymbol[network].symbol,
									qSymbol: b.symbol,
									bAddress: homeSymbol[network].address,
									qAddress: b.address,
								},
							});

							swapPrice[homeSymbol[network].symbol + "-" + b.symbol] = {
								[network]: {
									b: homeSymbol[network].address,
									q: b.address,
									p: "0",
								},
							};

							for (const c of tokens) {
								if (
									c.address !== homeSymbol[network].address &&
									c.address !== a.address &&
									c.address !== b.address
								) {
									route.c = {
										bSymbol: c.symbol,
										qSymbol: b.symbol,
										bAddress: c.address,
										qAddress: b.address,
									};

									swapPrice[c.symbol + "-" + b.symbol] = {
										[network]: {
											b: c.address,
											q: b.address,
											p: "0",
										},
									};

									// verboseLog &&
									// 	useSandwithArbitrage &&
									// 	console.log(
									// 		`🥪 ${a.symbol} -> ${b.symbol} -> ${c.symbol} -> ${homeSymbol[network].symbol}`
									// 	);

									useSandwithArbitrage &&
										tempSandwitchArbitrageRoutes.push({
											...route,
											d: {
												bSymbol: homeSymbol[network].symbol,
												qSymbol: c.symbol,
												bAddress: homeSymbol[network].address,
												qAddress: c.address,
											},
										});

									swapPrice[homeSymbol[network].symbol + "-" + c.symbol] = {
										[network]: {
											b: homeSymbol[network].address,
											q: c.address,
											p: "0",
										},
									};
								}
							}
						}
					}
				}
			}

			triangleArbitrageRoutes[network] = tempTriangleArbitrageRoutes;
			if (useSandwithArbitrage) sandwitchArbitrageRoutes[network] = tempSandwitchArbitrageRoutes;
		}
	} catch (error) {
		console.error(error.message);
	}
};

const checkArbitrage = async () => {
	try {
		for (const network of Object.keys(networkApiBaseURL)) {
			let i = 0;
			const workOnRoutes = fisherYates(
				useSandwithArbitrage ? sandwitchArbitrageRoutes[network] : triangleArbitrageRoutes[network]
			);
			for (let route of workOnRoutes) {
				i++;
				const duration = new Duration(new Date(startTime), new Date()).toString(1);
				const remain = (workOnRoutes.length - i) / requestsPerSecond;
				const remainDuration = new Date();
				const estimatedTime = new Duration(
					new Date(startTime),
					new Date(remainDuration.setSeconds(remain))
				).toString(1);
				verboseLog && console.log(`---------------${network}---------------`);
				verboseLog &&
					!useSandwithArbitrage &&
					console.log(
						`\u001b[1;35m${duration}\x1b[0m |	\u001b[1;32m${i++}\x1b[0m/${workOnRoutes.length} |	🔷 ${
							route.a.bSymbol
						} -> ${route.b.bSymbol} -> ${route.c.bSymbol}	|	${estimatedTime}`
					);
				verboseLog &&
					useSandwithArbitrage &&
					console.log(
						`\u001b[1;35m${duration}\x1b[0m |	\u001b[1;32m${i++}\x1b[0m/${workOnRoutes.length} |	🔷 ${
							route.a.bSymbol
						} -> ${route.b.bSymbol} -> ${route.c.bSymbol} -> ${route.d.bSymbol}`
					);

				for (const step of Object.keys(route)) {
					try {
						// const cache = swapPrice[route[step].bSymbol + "-" + route[step].qSymbol];

						if (!route["a"].amount)
							route[step].amount = toRawAmount(
								balance,
								tokensByNetwork[network][route[step].qAddress].decimals
							);

						const readableAmount = toHumanAmount(
							route[step].amount || "0",
							tokensByNetwork[network][route[step].qAddress].decimals
						);

						verboseLog &&
							console.log(
								`📡 STEP ${step} | \u001b[1;36m${readableAmount}\x1b[0m ${
									route[step].qSymbol
								} -> \u001b[1;33m???\x1b[0m ${route[step].bSymbol}		${route[step].amount ? "" : "🏠"}`
							);
						// console.log(
						// 	Object.values(tokensByNetwork[network]).find(
						// 		(token) => token.symbol === route[step].qSymbol
						// 	)
						// );

						const response = await axios
							.get(networkApiBaseURL[network] + "quote", {
								params: {
									toTokenAddress: route[step].bAddress,
									fromTokenAddress: route[step].qAddress,
									amount: route[step].amount,
									protocols: protocolsByNetwork[network],
								},
							})
							.catch((err) =>
								console.log(
									`${route[step].bSymbol + "-" + route[step].qSymbol}, error!`,
									`\u001b[1;31m${err.message}`
								)
							);

						const nextStep = stepId[stepId.indexOf(step) + 1];
						if (response && response.data && Object.hasOwnProperty.call(route, nextStep)) {
							route[nextStep].amount = response.data.toTokenAmount;
						}
						// console.log(response.data);

						const readablePriceB = toHumanAmount(
							response.data.toTokenAmount,
							response.data.toToken.decimals
						);

						const readablePriceQ = toHumanAmount(
							response.data.fromTokenAmount,
							response.data.fromToken.decimals
						);

						verboseLog &&
							console.log(
								`✅ STEP ${step} | \u001b[1;36m${readablePriceQ}\x1b[0m ${route[step].qSymbol} -> \u001b[1;32m${readablePriceB}\x1b[0m ${route[step].bSymbol}`
							);

						if (step == Object.keys(route)[Object.keys(route).length - 1]) {
							const entryBalance = route["a"].amount;
							const exitBalance = response.data.toTokenAmount;
							const readableEntryBalanace = Number(
								toHumanAmount(entryBalance, tokensByNetwork[network][route["a"].qAddress].decimals)
							);
							const readableExitBalance = Number(
								toHumanAmount(exitBalance, tokensByNetwork[network][route[step].bAddress].decimals)
							);
							const profit = readableExitBalance - readableEntryBalanace;

							// balance simulation
							balanceSimulation =
								profit > minProfitInHomeSymbol ? balanceSimulation + profit : balanceSimulation;
							const balanceSimulationPercent = (100 * (balanceSimulation - balance)) / balance;

							route.profit = profit;
							const readableProfit = profit;

							verboseLog &&
								console.log(
									`💰 Profit: ${
										readableProfit < minProfitInHomeSymbol
											? readableProfit > 0
												? "\u001b[1;33m"
												: "\u001b[1;31m"
											: "\u001b[1;32m"
									} ${readableProfit.toFixed(2)}\x1b[0m ${
										route["a"].qSymbol
									}	| 🪙 WALLET SIMULATION: \u001b[1;36m${balanceSimulation.toFixed(
										2
									)}\x1b[0m \u001b[1;35m${balanceSimulationPercent.toFixed()}%\x1b[0m	${
										readableProfit > minProfitInHomeSymbol
											? "<--------------------------------------------------------- 🤑 PRINT MONEY!"
											: ""
									}`
								);

							if (!verboseLog && readableProfit > minProfitInHomeSymbol) {
								!useSandwithArbitrage &&
									console.log(
										`\u001b[1;35m${duration}\x1b[0m |	\u001b[1;32m${i++}\x1b[0m/${
											workOnRoutes.length
										} |	🔷 ${route.a.bSymbol} -> ${route.b.bSymbol} -> ${route.c.bSymbol}`
									);
								useSandwithArbitrage &&
									console.log(
										`\u001b[1;35m${duration}\x1b[0m |	\u001b[1;32m${i++}\x1b[0m/${
											workOnRoutes.length
										} |	🔷 ${route.a.bSymbol} -> ${route.b.bSymbol} -> ${route.c.bSymbol} -> ${
											route.d.bSymbol
										}`
									);
								console.log(
									`💰 Profit: ${
										readableProfit < minProfitInHomeSymbol
											? readableProfit > 0
												? "\u001b[1;33m"
												: "\u001b[1;31m"
											: "\u001b[1;32m"
									} ${readableProfit.toFixed(2)}\x1b[0m ${
										route["a"].qSymbol
									}	| 🪙 WALLET SIMULATION: \u001b[1;36m${balanceSimulation.toFixed(
										2
									)}\x1b[0m \u001b[1;35m${balanceSimulationPercent.toFixed()}%\x1b[0m	${
										readableProfit > minProfitInHomeSymbol
											? "<--------------------------------------------------------- 🤑 PRINT MONEY!"
											: ""
									}`
								);
							}
						}
					} catch (error) {
						console.error(error.message);
					}
				}
			}
		}
	} catch (error) {
		console.error(error.message);
	}
};

const checkMultiNetwork = () => {
	const multiNetworkTokens = Object.values(tokensBySymbol).filter(
		(token) => Object.keys(token).length > 1
	);
	const wrappedTokens = Object.values(tokensBySymbol).filter((token) => {
		for (const network of Object.keys(token)) {
			console.log(Object.values(token[network])[0].name);
			if (String(Object.values(token[network])[0].name).includes("Wrapped")) return true;
		}
	});
	console.log(`Found ${multiNetworkTokens.length} multi network tokens`);
	console.log(`Found ${wrappedTokens.length} wrapped tokens`);
	// wrappedTokens.length > 0 && console.log(JSON.stringify(wrappedTokens, null, 2));
};

const run = async () => {
	try {
		await getAllTokens();
		console.log("Tokens by Symbol count", Object.keys(tokensBySymbol).length);
		console.log("Networks count", Object.keys(tokensByNetwork).length);

		searchForArbitrageRoutes();
		for (const network of Object.keys(networkApiBaseURL)) {
			console.log("Triangle Arbitrage Routes ", network, triangleArbitrageRoutes[network].length);
			useSandwithArbitrage &&
				console.log(
					"Sandwitch Arbitrage Routes ",
					network,
					sandwitchArbitrageRoutes[network].length
				);
		}
		console.log("All possible swap pairs to fetch prices", Object.keys(swapPrice).length);
		checkMultiNetwork();

		await getAllProtocols();

		// await getNativeTokenSwapPrices();

		// console.log(tokensByNetwork["POLYGON"][100]);

		// eslint-disable-next-line no-constant-condition
		while (true) {
			await checkArbitrage();
		}

		// console.log(getAvalancheQuote.data);
	} catch (error) {
		console.error(error.message);
	}
};

run();

// const getAvalancheQuote = await axios.get("https://api.1inch.io/v4.0/43114/quote", {
//     params: {
//         fromTokenAddress: "0xb599c3590F42f8F995ECfa0f85D2980B76862fc1",
//         toTokenAddress: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
//         amount: "1000",
//     },
// });
