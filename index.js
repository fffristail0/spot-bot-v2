require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const addSpotWizard = require('./scenes/addSpotWizard/addSpotWizard');
const shareWizard = require('./scenes/shareWizard/shareWizard');
const startCommand = require('./commands/start');
const addCommand = require('./commands/add');
const listCommand = require('./commands/list');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Stage с WizardScene
const stage = new Scenes.Stage([addSpotWizard, shareWizard]);

bot.use(session());
bot.use(stage.middleware());


// Подключаем команды
bot.start(startCommand);
bot.command('add', addCommand);
bot.command('list', listCommand);
bot.action(/^share:(.+)$/, async (ctx) => {
    const spotId = ctx.match[1];
    ctx.scene.enter('shareWizard', { spotId });
  });

bot.launch();
console.log('✅ Бот запущен!');
