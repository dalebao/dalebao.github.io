module.exports = getMonoRiQian
let quickAddApi;

async function getMonoRiQian (params) {
    console.log(apiGet('http://mmmono.com/group/100044/'));
}

async function apiGet(url) {
    let finalURL = new URL(url);
    return await fetch(finalURL, {
        method: 'GET', 
        
        cache: 'no-cache'
    })
}



