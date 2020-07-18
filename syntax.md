# VARIABLES

# Type: Number

// Create a Scoreboard Objective named 'varname'
let varname;

// Sets 'varname' in the global entity to 10
varname = 10;


## Type: Entity
// internally entities can't get evaluated and their code will be saved as a reference 
let entity = @a;
// creates a Scoreboard Objective named 'foo' and sets it to 15 for entity @a
let entity.foo = 15;


## Type: Bool
// Just uses tags


# CONSTANTS
// Not evaluated to code, just inserted everywhere
// They can't get changed:
const num = 10;
num = 5; // error

---


# Objects

let location = new Location(~, ~, ~1);
const block = new Block(location);

location.x += 1;
placeBlock(block, location);


# Datastructures

## Maps
let map = {
    foo: 'bar',
    bar: 'baz'
};

map.bar = 'lol';

## Typed Arrays
let array = [];
array.push(1);


# If

if (array[0] == 1) {
    say("hi");
}
else {
    say("bye");
}

# for

// Works with recursive functions

forEach (const entry in array) {
    say("entry: " + entry);
}

for (let i = 0; i < 10; ++i) {
    say(i);
}


# Functions
function fnName(arg1, arg2) {
    return "lol";
}

function blub(...args) {
    forEach(const arg in args) {
        say("argument: " + arg);
    }
}

jsfunction asdf() {
    // javascript stuff return mclang code as string or an array or object
}

# Class

class Location {
    let x, y, z;

    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    function str() {
        return this.x + " " + this.y + " " + this.z;
    }

    function getBlock() {
        const nbt = execute("blockdata " + location.str()).nbt();
    }
}

class Block {
    let nbt;
    
    constructor(nbt) {
        this.nbt = nbt;
    }

    function destroy() {
        /// ... needs to set air block at current position
    }

    jsfunction log() {

    }
}

# Event

listen BlockPlaceEvent(@p) {
    say("Placed: " + event.block.name);
}

# Import

import './somefile';


# Internally

Constant Expressions are automatically detected and compiled out for performance reasons.
So For-Loops with only constants given will generate the code for it without doing some fancy function stuff. 
