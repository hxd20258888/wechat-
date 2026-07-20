function normalizeTransactionResult(transactionResult) {
  if (transactionResult && typeof transactionResult.code === 'number') {
    return transactionResult
  }

  if (transactionResult && transactionResult.result && typeof transactionResult.result.code === 'number') {
    return transactionResult.result
  }

  return { code: -1, message: '预约提交失败，请重试', data: null }
}

module.exports = { normalizeTransactionResult }
