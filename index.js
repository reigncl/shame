const util = require('util')
const moment = require('moment')
const Harvest = require('harvest-v2');
const slack = require("slack")
const _ = require("underscore")
const fetch = require("node-fetch");
require('dotenv').config()
let SHAME_AFTER_DAYS=4
let blacklist = process.env.BLACKLIST.split(",")
let harvest = new Harvest({
        account_ID: process.env.HARVEST_ACCOUNT,
        access_token: process.env.HARVEST_TOKEN,
        user_agent: 'Harvest API'
    });


exports.main = async () => {
  
  
    
    let slackUsers = await slack.users.list({token:process.env.SLACK_TOKEN, limit:200})
    let members = slackUsers.members.filter(u => !u.deleted && !u.is_bot)
    // members.forEach(u => {
    //   console.log(u.name+"/"+u.real_name+"/"+u.profile.email)
    // })
    const findSlackUsername = (email, real_name) => {
      var member = members.filter(m => m.profile.email == email)[0]
      if (member) {
        return member.name
      }
      //if the email doesnt match try full name match
      member = members.filter(m => m.real_name == real_name)[0]
      if (member) {
        return member.name
      }
      
    }
    
    const users = (await harvest.users.list()).users.filter(u => u.is_active).filter(u => !blacklist.includes(u.first_name+" "+u.last_name)).filter(u => (moment().diff(moment(u.created_at),"days")>SHAME_AFTER_DAYS))
    var tes = []
    var lastTimeSheetByPerson = {}
    for (page of [1,2,3,4,5]) {
      tes = tes.concat((await harvest.timeEntries.listBy({
        per_page:'100',
        page: page
      })).time_entries) 
    }
    tes.forEach(t => {
      if (!lastTimeSheetByPerson[t.user.name]) {
        lastTimeSheetByPerson[t.user.name]=t.spent_date
      }
    })
    console.log("Last time sheet by each person:")
    console.dir(lastTimeSheetByPerson)
    let shameNotifications = []
    let images = []
    for (let user of users) {
      const name = user.first_name+" "+user.last_name
      let slackUsername = findSlackUsername(user.email, name)
      if (!slackUsername) {
        console.warn(`Can't find username for ${user.email}`)
      }
      if (lastTimeSheetByPerson[name]) {
        const m = moment(lastTimeSheetByPerson[name])
        let daysago = moment().diff(m,"days")
        if (daysago>SHAME_AFTER_DAYS) {
          let daysago = m.from()
          let text =  `Last timesheet by ${name} was ${daysago}. `
          if (slackUsername) {
            text+=`SHAME @${slackUsername} !`
            let custom = encodeURIComponent(`${name} is ${daysago.replace("ago","late")} for timesheets`.toUpperCase())
            let url = `https://res.cloudinary.com/difpuy0ix/image/upload/l_text:Impact_28_bold:${custom},g_north,w_400,c_fit,y_20,co_rgb:FFFFFF/e_shadow:4,co_black,x_-1,y_-1/fl_layer_apply/w_300,c_scale/shame2.gif`
            images.push(url)
          }
          shameNotifications.push(text)  
             
        } else {
          //you're ok
        }
      } else {
        let text =  `Last timesheet by ${name} was unknown. `
        if (slackUsername) {
          text+=`SHAME @${slackUsername} !`
        }
        shameNotifications.push(text)  
      }
    }
    if (shameNotifications.length>0) {
        let randomImage = _.sample(images) || ""
        if (randomImage) {
          await fetch(randomImage)
        }
        let notification = ":bell: :bell: :bell: i see missing timesheets!\n"+shameNotifications.join("\n")+"\n\nGo to https://reigndesign.harvestapp.com/time/ to fill out your timesheets."
        console.log(notification)
        await slack.chat.postMessage({username:"Nagging Nun",link_names:true, attachments:[{fallback:"SHAME!",image_url:randomImage}],token:process.env.SLACK_TOKEN, channel:process.env.SLACK_CHANNEL, as_user:false, text:notification, icon_emoji:":shame:"})
    } else {
      console.log("Nobody to shame today")
    }
    
  

}