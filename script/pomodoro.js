module.exports = control;

let list = ["👉️ 开始", "👌 切换", "🤚 退出"]
let code = ["0", "1", "2"]

let quickAddApi;
async function control(params){
    ({quickAddApi} = params);
    const item = await quickAddApi.suggester(list, code);
    if(item == "0"){
        app.plugins.plugins["obsidian-statusbar-pomo"].settings.pomo = 13
        app.commands.executeCommandById("obsidian-statusbar-pomo:start-satusbar-pomo");
    }
    if(item == "1"){
        app.commands.executeCommandById("obsidian-statusbar-pomo:pause-satusbar-pomo");
    }
    if(item == "2"){
        app.commands.executeCommandById("`");
    }
    // app.setting.pluginTabs[31].plugin.settings.pomo
    // app.setting.pluginTabs[31].plugin.settings.pomo = 13
    console.log(params );

}