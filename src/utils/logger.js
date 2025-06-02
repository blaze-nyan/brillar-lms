const pino = require("pino");
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
logger.info("Logger initialized");
logger.debug("Debugging information");
logger.error("Error logging example");
logger.warn("Warning message example");
logger.fatal("Fatal error example");
logger.trace("Trace message example");
module.exports = logger;
