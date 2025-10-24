require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const addSpotWizard = require('./scenes/addSpotWizard/addSpotWizard');
const shareWizard = require('./scenes/shareWizard/shareWizard');
const startCommand = require('./commands/start');
const addCommand = require('./commands/add');
const listCommand = require('./commands/list');

if (!process.env.BOT_TOKEN) {
  console.error('ENV ERROR: BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

const stage = new Scenes.Stage([addSpotWizard, shareWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.telegram.setMyCommands([
  { command: 'start', description: 'Начать' },
  { command: 'add', description: 'Добавить спот' },
  { command: 'list', description: 'Мои споты' }
]);

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  if (ctx?.reply) ctx.reply('⚠️ Произошла ошибка, попробуйте ещё раз.');
});

bot.start(startCommand);
bot.command('add', addCommand);
bot.command('list', listCommand);
bot.action(/^share:(.+)$/, async (ctx) => {
  const spotId = ctx.match[1];
  return ctx.scene.enter('shareWizard', { spotId });
});

bot.launch().then(() => console.log('✅ Бот запущен!'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
