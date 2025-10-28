require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const { Agent, setGlobalDispatcher } = require('undici');
const { env, assertRequired } = require('./config/env');
const { createLogger } = require('./utils/logger');

const addSpotWizard = require('./scenes/addSpotWizard/addSpotWizard');
const shareWizard = require('./scenes/shareWizard/shareWizard');
const startCommand = require('./commands/start');
const addCommand = require('./commands/add');
const listCommand = require('./commands/list');
const mapCommand = require('./commands/map');
const helpCommand = require('./commands/help');
const shareAction = require('./actions/share');
const delAction = require('./actions/del');
const delcAction = require('./actions/delc');
const noopAction = require('./actions/noop');
const cb = require('./utils/callback');

assertRequired();

// Undici keep-alive для стабильного fetch
setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 10_000,
  connections: 100
}));

const log = createLogger('bot', env.BOT.logLevel);
const bot = new Telegraf(env.BOT.token);

const stage = new Scenes.Stage([addSpotWizard, shareWizard]);
bot.use(session());
bot.use(stage.middleware());

bot.telegram.setMyCommands([
  { command: 'start', description: 'Начать' },
  { command: 'add', description: 'Добавить спот' },
  { command: 'list', description: 'Мои споты' },
  { command: 'map', description: 'Открыть все споты на карте' },
  { command: 'help', description: 'Показать справку' }
]);

bot.catch((err, ctx) => {
  log.error('Bot error:', err);
  if (ctx?.reply) ctx.reply('⚠️ Произошла ошибка, попробуйте ещё раз.');
});

bot.start(startCommand);
bot.command('add', addCommand);
bot.command('list', listCommand);
bot.command('map', mapCommand);
bot.command('help', helpCommand);

// Единый формат callback_data
bot.action(cb.regex('share'), shareAction);
bot.action(cb.regex('del'), delAction);
bot.action(cb.regex('delc'), delcAction);
bot.action(/^noop$/, noopAction);

bot.launch().then(() => log.info('✅ Бот запущен!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));