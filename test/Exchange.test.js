const { default: Web3 } = require('web3')
import { now } from 'lodash'
import { tokens, ether, EVM_REVERT, ETHER_ADDRESS } from './helpers'
const Token = artifacts.require('./Token')
const Exchange = artifacts.require('./Exchange')

require('chai')
    .use(require('chai-as-promised'))
    .should()



contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
    let token
    let exchange
    const feePercent = 10

    beforeEach(async () => {
        token = await Token.new()
        token.transfer(user1, tokens(100), {from: deployer})
        exchange = await Exchange.new(feeAccount, feePercent)
        
    })
    
    describe('deployment', () => {

        
        it('tracks the fee account', async () => {
            const result = await exchange.feeAccount()
            result.should.equal(feeAccount)
        })

        it('tracks the fee percent', async () => {
            const result = await exchange.feePercent()
            result.toString().should.equal(feePercent.toString())
        })
    })

    describe('fallback', () => {
        it('reverts when Ether is sent', async () => {
            await exchange.sendTransaction({value: 1, from: user1}).should.be.rejectedWith(EVM_REVERT)
        })
    })

    describe('depositing Ether', () => {
        let result
        let amount
        
        describe('success', () => {
            
            beforeEach(async () => {
                amount = ether(1)
                result = await exchange.depositEther({from: user1, value: amount})
            })
            
            it('tracks the Ether deposit', async () => {
                const balance = await exchange.tokens(ETHER_ADDRESS, user1)
                balance.toString().should.equal(amount.toString())
            })

            it('emits the deposit event', async () => {
                const log = result.logs[0]
                log.event.should.eq('Deposit')
                const event = log.args
                event.token.toString().should.equal(ETHER_ADDRESS, 'Ether address is correct')
                event.user.toString().should.equal(user1, 'user is correct')
                event.amount.toString().should.equal(amount.toString(), 'amount is correct')
                event.balance.toString().should.equal(amount.toString(), 'balance is correct')
            })
        })

        describe('failure', () => {
            it('rejects Ether deposits', async () => {
                await exchange.depositToken(ETHER_ADDRESS, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT)
            })

            it('when no tokens are approved', async () => {
                await exchange.depositToken(token.address, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('depositing tokens', () => {
        let result
        let amount
        
        describe('success', () => {
            
            beforeEach(async () => {
                amount = tokens(10)
                await token.approve(exchange.address, tokens(10), {from: user1})
                result = await exchange.depositToken(token.address, tokens(10), {from: user1})
            })
            
            it('tracks the token deposit', async () => {
                let balance
                balance = await token.balanceOf(exchange.address)
                balance.toString().should.equal(amount.toString())
                // Exchange token balance
                balance = await exchange.tokens(token.address, user1)
                balance.toString().should.equal(amount.toString())
            })

            it('emits the deposit event', async () => {
                const log = result.logs[0]
                log.event.should.eq('Deposit')
                const event = log.args
                event.token.toString().should.equal(token.address, 'token address is correct')
                event.user.toString().should.equal(user1, 'user is correct')
                event.amount.toString().should.equal(tokens(10).toString(), 'amount is correct')
                event.balance.toString().should.equal(tokens(10).toString(), 'balance is correct')
            })
        })

        describe('failure', () => {
            it('rejects Ether deposits', async () => {
                await exchange.depositToken(ETHER_ADDRESS, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT)
            })

            it('when no tokens are approved', async () => {
                await exchange.depositToken(token.address, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('withdrawing Ether', () => {
        let result
        let amount

        beforeEach(async () => {
            amount = ether(1)
            await exchange.depositEther({from:user1, value: amount})
        })
    
        describe('success', async () => {
            beforeEach(async () => {
                result = await exchange.withdrawEther(amount, {from:user1})
            })

            it('tracks the Ether withdraw funds', async () => {
                const balance = await exchange.tokens(ETHER_ADDRESS, user1)
                balance.toString().should.equal('0')
            })

            it('emits Withdraw event', async () => {
                const log = result.logs[0]
                log.event.should.eq('Withdraw')
                const event = log.args
                event.token.toString().should.equal(ETHER_ADDRESS, 'Ether address is correct')
                event.user.toString().should.equal(user1, 'user is correct')
                event.amount.toString().should.equal(amount.toString(), 'amount is correct')
                event.balance.toString().should.equal('0')
            
            })
        })

        describe('failure', async () => {
            it('rejects insufficient amount of Ether withdraw', async() => {
                await exchange.withdrawEther(ether(100), {from: user1}).should.be.rejectedWith(EVM_REVERT);
            })
        })
    })

    describe('withdrawing tokens', () => {
        let result
        let amount

        describe('success', async () => {
            beforeEach(async() => {
                amount = tokens(10)
                await token.approve(exchange.address, amount, {from: user1})
                await exchange.depositToken(token.address, amount, {from: user1})
    
                result = await exchange.withdrawToken(token.address, amount, {from: user1})
            })
            
            it('tracks the token withdraw', async() => {
                const balance = await exchange.tokens(token.address, user1)
                balance.toString().should.equal('0') 
            })

            it('tracks the Withdraw event', async() => {
                const log = result.logs[0]
                log.event.should.eq('Withdraw')
                const event = log.args
                event.token.toString().should.equal(token.address, 'Ether address is correct')
                event.user.toString().should.equal(user1, 'user is correct')
                event.amount.toString().should.equal(amount.toString(), 'amount is correct')
                event.balance.toString().should.equal('0')
            
            })
        })

        describe('failure', async() => {
            it('rejects ETHER withdraws', async() => {
                await exchange.withdrawToken(ETHER_ADDRESS, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT);
            })
            
            it('rejects insufficient amount of Purp token withdraw', async() => {
                await exchange.withdrawToken(token.address, tokens(10000), {from: user1}).should.be.rejectedWith(EVM_REVERT);
            })
        })
    })

    describe('checking balances', () =>{
        beforeEach(async() => {
            await exchange.depositEther({from:user1, value:ether(1)})
        })

        it('returns user balance', async() => {
            const result = await exchange.balanceOf(ETHER_ADDRESS, user1)
            result.toString().should.equal(ether(1).toString())
        })
    })

    describe('making orders', async () => {
        let result
        beforeEach(async () => {
            result = await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), {from:user1})
        })

        it('tracks the newly created order', async() => {
            const orderCount = await exchange.orderCount()
            orderCount.toString().should.equal('1')
            const order = await exchange.orders('1')
            order.id.toString().should.equal('1')
            order.user.toString().should.equal(user1, 'user is correct')
            order.tokenGet.toString().should.equal(token.address, 'TokenGet address is correct')
            order.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
            order.tokenGive.toString().should.equal(ETHER_ADDRESS.toString(), 'tokenGive is correct')
            order.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
            order.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
        })

        it('emits an Order event', async() => {
            const log = result.logs[0]
            log.event.should.eq('Order')
            const event = log.args
            event.id.toString().should.equal('1')
            event.user.toString().should.equal(user1, 'user is correct')
            event.tokenGet.toString().should.equal(token.address, 'TokenGet address is correct')
            event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
            event.tokenGive.toString().should.equal(ETHER_ADDRESS.toString(), 'tokenGive is correct')
            event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
            event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
        })
    })

    describe('order actions', async() => {

        beforeEach(async() => {
            await exchange.depositEther({from:user1, value: ether(1)})
            await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), {from: user1})
        })

        describe('cancelling orders', async() => {
            let result

            describe('success', async() => {
                beforeEach(async() => {
                    result = await exchange.cancelOrder('1', {from:user1})
                })

                it('updates cancelled orders', async() => {
                    const orderCancelled = await exchange.orderCancelled(1)
                    orderCancelled.should.equal(true)
                })

                it('emits an Cancel event', async() => {
                    const log = result.logs[0]
                    log.event.should.eq('Cancel')
                    const event = log.args
                    event.id.toString().should.equal('1')
                    event.user.toString().should.equal(user1, 'user is correct')
                    event.tokenGet.toString().should.equal(token.address, 'TokenGet address is correct')
                    event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
                    event.tokenGive.toString().should.equal(ETHER_ADDRESS.toString(), 'tokenGive is correct')
                    event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
                    event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
                })
            })

            describe('failure', async() => {
                it('rejects invalid order ids', async() => {
                    const invalidOrder = 999999
                    await exchange.cancelOrder(invalidOrder, {from:user1}).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects unauthorized cancellations', async() => {
                    await exchange.cancelOrder('1', {from:user2}).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })
    })
})