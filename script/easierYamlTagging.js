module.exports = easierYamlTagging
let quickAddApi;

async function easierYamlTagging (params) {
    ({quickAddApi} = params) 
    let str =  await quickAddApi.inputPrompt("🏷️ 标签");
    return str.replace(/#/g,'').replace(/\s/g,',').replace(/(^,*)|(,*$)/g, '').replace(/,{2,}/g,',').replace(/,/g,', ');
}
