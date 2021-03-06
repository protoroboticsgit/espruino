exports.connect = function (P, cb) {
    let wifi = require("Wifi");
    let ws={
        "obj":null,
        "cb":null,
        "reconnect":null,
        "watchers":{},
        "events":{},
        "connect":(cb)=>{
            let WebSocket = require("ws");
            ws.obj = new WebSocket(P.server,{
                path: '/',
                origin: 'Espruino',
                headers:{ "key":P.key }
            });

            ws.cb=cb;

            ws.obj.on('open', function() {
                clearInterval(ws.reconnect);
                ws.cb(true);
            });

            ws.obj.on('error', function(d) {
                console.log("error",d);
            });

            ws.obj.on('message', function(msg) {                
                let m=JSON.parse(msg);
                switch(m[0]){
                    case "VG":
                        if(!P.disable || P.disable.indexOf("getvariable")===-1){
                            ws.obj.send(JSON.stringify([ "VG",m[1], global[m[1]] ]));
                        }
                    break;
                    case "VS":
                        if(!P.disable || P.disable.indexOf("setvariable")===-1){
                            if(typeof global[m[1]]!=="undefined"){
                                global[m[1]] = m[2];   
                                ws.obj.send(JSON.stringify([ "VS", m[1], true ]));
                            }else{
                                ws.obj.send(JSON.stringify([ "VS", m[1], false ]));
                            }
                        }
                    break;
                    case "F":
                        if(!P.disable || P.disable.indexOf("function")===-1){
                            try{
                                let r = false;
                                
                                if(m[2]){
                                    r=global[m[1]](m[2]);
                                }else{
                                    r=global[m[1]]();
                                }

                                ws.obj.send(JSON.stringify([ "F", m[1], r ]));
                            }catch(e){
                                ws.obj.send(JSON.stringify([ "F", m[1], e.toString() ]));
                            }
                            
                        }
                    break;
                    case "X":
                        if(!P.disable || P.disable.indexOf("exec")===-1){
                            try{
                                eval(m[2]);
                                ws.obj.send(JSON.stringify([ "X", m[1], "" ]));
                            }catch(e){
                                ws.obj.send(JSON.stringify([ "X", m[1], e.toString() ]));
                            }
                            
                        }                        
                    break;
                    case "R":
                        if(!P.disable || P.disable.indexOf("reboot")===-1){
                            E.reboot();
                        }
                    break;
                    case "W":
                        if(!P.disable || P.disable.indexOf("watcher")===-1){
                            if(!m[2] && typeof ws.watchers[m[1]]!=="undefined"){
                                    clearInterval(ws.watchers[m[1]]);
                            }else if(typeof ws.watchers[m[1]]==="undefined" && typeof global[m[1]]!=="undefined"){                            
                                
                                ws.watchers[m[1]] = setInterval(()=>{
                                    if(typeof global[m[1]] === "function"){
                                        let r = global[m[1]](m[2]);
                                        ws.obj.send(JSON.stringify([ "W", m[1], r ]));
                                    }else{
                                        ws.obj.send(JSON.stringify([ "W",m[1], global[m[1]] ]));
                                    }
                                },m[2]);

                            }else{
                                ws.obj.send(JSON.stringify([ "W", m[1], false ]));
                            }        
                        }                
                    break;
                }
            });
            

            //If the websocket closes then try to reconnect every 5s
            ws.obj.on('close', function() {
                setTimeout( ()=>{ ws.connect(ws.cb); }, 5000 );
                ws.cb(false);   
            });
        }
    }
    
    /*******************************************
     * WIFI related logic
     *******************************************/
    let connectToWifi=()=>{
        wifi.connect(P.sid, { password : P.pwd }, function(err) {
            if (err) {
                cb(false);
                return;
            }
            console.log("Connected to wifi...connecting to the cloud.");
            ws.connect(cb);
        });
    };
    
    connectToWifi();
    
    
    wifi.on('disconnected', function(details) {
        setTimeout( ()=>{ 
            
            console.log("Reconnecting to wifi");
            connectToWifi();

         } ,5000 );
    });


    /*******************************************
     * Functions available from the device program
     *******************************************/
    return {
        event:(eventName, eventValue)=>{
            ws.obj.send(JSON.stringify(["E",eventName, eventValue]));
        }
    };
}
