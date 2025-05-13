function logIsEvent(log, event) {
    let ok = log.event === event[0];
    for (let i = 1; i < event.length; ++i) {
      ok &= log.args[(i - 1).toString()].toString() === event[i].toString();
    }
    return ok;
  }
  
  function receiptHasEvent(tx, event) {
    return tx.logs.some((log) => logIsEvent(log, event));
  }
  
  module.exports = {
    logIsEvent, receiptHasEvent
  };