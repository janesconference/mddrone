define(['require', 'github:janesconference/KievII@0.6.0/kievII'], function(require, K2) {
  
    var pluginConf = {
        name: "Matt D.'s Drone",
        audioOut: 1,
        audioIn: 0,
        version: '0.0.1',
        hyaId: 'MDDrone',
        ui: {
            type: 'canvas',
            width: 274,
            height: 180
        },
        hostParameters : {
            enabled: false,
            parameters: {
                noteParm: {
                    name: 'Note',
                    range: {
                        min: 40,
                        default: 44,
                        max: 100
                    },
                    groupID: 'fxControls'
                },
                voiceParm: {
                    name: 'Voices',
                    range: {
                        min: 1,
                        default: 14,
                        max: 40
                    },
                    groupID: 'fxControls'
                }
            },
            groups: {
                fxControls: {
                    name: 'FX Controls'
                }
            }
        }
    };
  
    var pluginFunction = function (args, resources) {
        
        this.name = args.name;
        this.id = args.id;
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;
        var knobImage =  resources[0];
		var deckImage =  resources[1];


        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                noteKnob: 0.44,
                voiceKnob: 0.4,
            };
        }
        
        /* From 40 to 100 */
        this.baseNote = 44;
        /* From 1 to 40 */
        this.nOsc = 14;
        
        //connect gain
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = 15.0;
        this.gainNode.connect(this.audioDestination);
        
        this.noiseNodes = [];
        this.noiseFilters = [];
        this.bufferLen = 4096;
        
        this.createNoiseGen = function (freq) {
          this.panner = this.context.createPanner();
          var max = 20;
          var min = -20;
          var x = rand(min, max);
          var y = rand(min, max);
          var z = rand(min, max);
          this.panner.setPosition(x, y, z);
          this.panner.connect(this.gainNode);
        
          var filter = this.context.createBiquadFilter();
          filter.type = filter.BANDPASS;
          filter.frequency.value = freq;
          filter.Q.value = 150;
          filter.connect(this.panner);
        
          var noiseSource = this.context.createScriptProcessor(this.bufferLen, 1, 2);
          noiseSource.onaudioprocess = function (e) {
            var outBufferL = e.outputBuffer.getChannelData(0);
            var outBufferR = e.outputBuffer.getChannelData(1);
            for (var i = 0; i < this.bufferLen; i++) {
              outBufferL[i] = outBufferR[i] = Math.random() * 2 - 1;
            }
          }.bind(this);
          noiseSource.connect(filter);
          this.noiseNodes.push(noiseSource);
          this.noiseFilters.push(filter);

          setInterval(function () {
            x = x + rand(-0.1, 0.1);
            y = y + rand(-0.1, 0.1);
            z = z + rand(-0.1, 0.1);
            this.panner.setPosition(x, y, z);
          }.bind(this), 500);
        
        };
        
        this.scale = [0.0, 2.0, 4.0, 6.0, 7.0, 9.0, 11.0, 12.0, 14.0];
        
        this.generate = function () {
          var base_note = this.baseNote;
          var num_osc = this.nOsc;
          for (var i = 0; i < num_osc; i++) {
            var degree = Math.floor(Math.random() * this.scale.length);
            var freq = mtof(base_note + this.scale[degree]);
            freq += Math.random() * 4 - 2;
            this.createNoiseGen(freq);
          }
        };
        
        function mtof(m) {
          return Math.pow(2, (m - 69) / 12) * 440;
        }
        
        function rand(min, max) {
          return Math.random() * (max - min) + min;
        }
        
        this.reset = function () {
          while (this.noiseNodes.length){
            this.noiseNodes.pop().disconnect();
          }
          while (this.noiseFilters.length) {
            this.noiseFilters.pop().disconnect();
          }
          this.generate();
        };
        
        this.generateWithParams = function(note, voices) {
            if (typeof voices === 'number') {
                this.baseNote = note;
            }
            if (typeof voices === 'number') {
                this.nOsc = voices;
            }
            this.reset();
        };
        
        this.changeNote = function(note) {
            
            var len = this.noiseFilters.length;
            
            if (len === 0) {
                this.generateWithParams (note);
                return;
            }
            
            this.baseNote = note;
            
            for (var i = 0; i < len; i+=1) {
                var degree = Math.floor(Math.random() * this.scale.length);
                var freq = mtof(this.baseNote + this.scale[degree]);
                freq += Math.random() * 4 - 2;
                this.noiseFilters[i].frequency.value = freq;
            }
            
        };
        
        this.changeVoices = function(voices) {
            this.nOsc = voices;
            this.reset();
        };

        this.noteCallback = function(noteValue) {
            this.changeNote (noteValue);
        }.bind(this);

        this.voiceCallback = function(voiceValue) {
            this.changeVoices (voiceValue);
        }.bind(this);

        /* Parameter callbacks */
        this.onParmChange = function (id, value) {
            this.pluginState[id] = value;
            if (id === 'noteParm') {
                this.noteCallback (value);
            }
            else if (id === 'voiceParm') {
                this.voiceCallback (value);
            }

        };

        if (pluginConf.hostParameters.enabled === true) {
            args.hostInterface.setInstanceStatus ('ready');
            return;
        }

        /**********
         * The UI *
         * ********/

        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});

        /* Deck */
        var bgArgs = new K2.Background({
           ID: 'background',
           image: deckImage,
           top: 0,
           left: 0
        });
    
       this.ui.addElement(bgArgs, {zIndex: 0});

        /* labels */
        var freqLabel = new K2.Label({
            ID: 'freqLabel',
            width : 100,
            height : 20,
            top : 127,
            left : 28,
            transparency: 0.87,
            objParms: {
                font: "20px VT323",
                textColor: "#000",
                textBaseline: "top",
                textAlignment: "left"
            }
        });
        var voiceLabel = new K2.Label({
            ID: 'voiceLabel',
            width : 100,
            height : 20,
            top : 127,
            left : 168,
            transparency: 0.87,
            objParms: {
                font: "20px VT323",
                textColor: "#000",
                textBaseline: "top",
                textAlignment: "left"
            }
        });
        this.ui.addElement(freqLabel, {zIndex: 3});
        this.ui.addElement(voiceLabel, {zIndex: 3});
       
       var noteKnobArgs = {
            imagesArray : [knobImage],
            tileWidth: 60,
            tileHeight: 60,
            imageNum: 61,
            bottomAngularOffset: 33,
            ID: "noteKnob",
            left: 38,
            top: 57,
            onValueSet: function(slot, value, element) {
                this.pluginState[element] = value;
                var noteValue = Math.round(K2.MathUtils.linearRange(0, 1, 40, 100, value));
                this.noteCallback (noteValue);
                var padVaule = (noteValue >= 100) ? '' : ' ';
                var labelValue = padVaule + noteValue.toFixed(2) + " Hz";
                this.ui.setValue({
                    elementID : 'freqLabel',
                    slot : 'labelvalue',
                    value : labelValue
                });
                this.ui.refresh();
            }.bind(this),
            isListening : true
        };
            
        var voiceKnobArgs = {
                imagesArray : [knobImage],
                tileWidth: 60,
                tileHeight: 60,
                imageNum: 61,
                bottomAngularOffset: 33,
                ID: "voiceKnob",
                left: 178,
                top: 57,
                onValueSet : function(slot, value, element) {
                    this.pluginState[element] = value;
                    var voiceValue = Math.round(K2.MathUtils.linearRange(0, 1, 1, 40, value));
                    this.voiceCallback (voiceValue);

                    var padVaule = (voiceValue >= 10) ? '' : ' ';
                    var voiceString = (voiceValue === 1) ? ' Voice' : ' Voices';
                    var labelValue = padVaule + voiceValue + voiceString;
                    this.ui.setValue({
                        elementID : 'voiceLabel',
                        slot : 'labelvalue',
                        value : labelValue
                    });
                    this.ui.refresh();
                }.bind(this),
                isListening : true
        };
            
        this.ui.addElement(new K2.Knob(noteKnobArgs));
        
        this.ui.setValue({
            elementID : noteKnobArgs.ID,
            slot : 'knobvalue',
            value : this.pluginState[noteKnobArgs.ID]
        });
    
        this.ui.addElement(new K2.Knob(voiceKnobArgs));
        this.ui.setValue({
            elementID : voiceKnobArgs.ID,
            slot : 'knobvalue',
            value : this.pluginState[voiceKnobArgs.ID]
        });
        
        this.ui.refresh();

        var saveState = function () {
            return { data: this.pluginState };
        };
        args.hostInterface.setSaveState (saveState.bind (this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };
  
    var initPlugin = function(initArgs) {
        var args = initArgs;

        if (pluginConf.hostParameters.enabled === true) {
            pluginFunction.call (this, args, [undefined, undefined]);
            return;
        }

        var requireErr = function (err) {
            var failedId = err.requireModules && err.requireModules[0];
            requirejs.undef(failedId);
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error loading plugin resources'});
        }.bind(this);
        
        require (['./assets/images/knob_60_60_61f.png!image',
                  './assets/images/MDDDeck.png!image',
                  '#google VT323 !font'],
            function () {
                var resources = arguments;
                pluginFunction.call (this, args, resources);
            }.bind(this),
            requireErr
        );
    };
    
    return {
        initPlugin: initPlugin,
        pluginConf: pluginConf
    };
});
