
let currentSpecial = -1

const actionList = [

    function spawnCreature(x, y) {
        //log(`creature at ${x}:${y}`)
        let tribe = 1
        if (env.selected && env.selected.tribe) tribe = env.selected.tribe

        lab.port.spawn( dna.space.Creature, { tribe, x, y, })
    },

    function spawnDeposit(x, y) {
        //log(`deposit at ${x}:${y}`)
        const mass = env.tune.comet.baseMass + env.tune.comet.varMass * lib.source.comet.rndf()
        lab.port.spawn( dna.space.MineralDeposit, {
            x:    x,
            y:    y,
            r:    mass,
            mass: mass,
        })
    },

    function spawnComet(x, y) {
        //log(`comet at ${x}:${y}`)
        const sourceR = 2 * env.beltRadius
        const mass = env.tune.comet.baseMass + env.tune.comet.varMass * lib.source.comet.rndf()
        lab.port.spawn( dna.space.Comet, {
            x:     x,
            y:     y,
            r:     mass,
            mass:  mass,
            warpR: 1.2 * sourceR,
        })
    },
]

function switchSpecialAction() {
    if (!env.debug) return

    currentSpecial ++
    if (currentSpecial >= actionList.length) currentSpecial = -1

    lib.specialAction = actionList[currentSpecial]
    if (!lib.specialAction) log('Special Action: none')
    else log(`Special Action: ${lib.specialAction.name}`)
}
