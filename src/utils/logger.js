const pino = require("pino");
const pinoHttp = require("pino-http");

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

const expressMiddleware = () => {
  return pinoHttp({
    logger,
    autoLogging: true,
    useLevel: "info",
  });
};

const logInfo = (message, data = {}) => {
  logger.info({ message, data });
};

const logError = (message, error = null, data = {}) => {
  if (error) {
    logger.error({ err: error, ...data }, message);
  }
  logger.error({ message, data });
};
const logWarn = (message, data = {}) => {
  logger.warn({ message, data });
};
const logDebug = (message, data = {}) => {
  logger.debug({ message, data });
};
const createChildLogger = (childName) => {
  return logger.child({ child: childName });
};

module.exports = {
  logger,
  logInfo,
  logError,
  logWarn,
  logDebug,
  createChildLogger,
  expressMiddleware,
};
