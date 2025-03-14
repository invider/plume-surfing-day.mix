const Body = require('dna/space/Body')

let id = 0

class Creature extends Body {

    constructor(st) {
        super( extend({
            type:   'creature',
            name:   'creature' + (++id),
            tribe:   0,
            hp:      100,
            maxHP:   env.tune.creature.baseHP,
            fortune: 0,
            r:       30,
            dir:     0,    // points to where the creature is looking at

            maxSurfaceSpeed:         env.tune.creature.baseSurfaceSpeed,
            surfacePushForce:        env.tune.creature.baseSurfaceForce,
            surfaceJumpAcceleration: env.tune.creature.baseSurfaceJump,
            hitForce:                env.tune.creature.baseHitForce,

            hitLog: [],
            lastReproduction: 0,

            warpR: env.beltRadius,
        }, st) )

        this.install([
            new dna.space.pod.Momentum({
                mass: 100,
            }),
            new dna.space.pod.GravityEffect({
                boundable: true,
            }),
            new dna.space.pod.SolidCircle({
                r: 18,
            }),
            new dna.space.pod.HealthPod(),
            new dna.space.pod.SmartBot(),
        ])

        if (env.debug) {
            this.install([
                //new dna.space.pod.RadiusProbe(),
                //new dna.space.pod.CoordinatesProbe({
                //    x: -this.r,
                //    y: 1.5 * this.r,
                //}), 
                new dna.space.pod.MomentumProbe(),
                new dna.space.pod.SelectionIndicator(),
                new dna.space.pod.BotProbe({
                    x: -this.r * .8,
                    y:  this.r * .8,
                }),
            ])
        }

        this.hp = this.maxHP
        this.color = env.style.color.tribe[this.tribe]
    }

    wakeUp() {
        if (this.surfaced) {
            log(`[${this.getTitle()}] is waking up!`)
            this.momentum.surfaceJumpAction(env.tune.creature.wakeUpJump)
            this.momentum.surfacePropelAction(env.tune.creature.wakeAcceleration)
            if (this.bot.switchAttitude) this.bot.switchAttitude()
        }
    }

    pay(value) {
        if (this.fortune < value) return false
        this.fortune = floor(this.fortune - value)
        return true
    }

    collect(value) {
        this.fortune = floor(this.fortune + value)
    }

    registerHit(source) {
        if (this.hitLog.length > 0 && this.hitLog[0].timestamp + 2*env.tune.creature.hitDelay < env.time) {
            this.hitLog.shift()
        }

        let lastHit  = null
        this.hitLog.forEach(e => {
            if (e.source === source) lastHit = e
        })

        if (lastHit && lastHit.timestamp + env.tune.creature.hitDelay > env.time) return false
        this.hitLog.push({
            timestamp: env.time,
            source:    source,
        })
        source.hitLog.push({
            timestamp: env.time,
            source:    this,
        })
        return true
    }

    damage(hits, source) {
        this.hp -= hits
        // TODO particle effect
        const surface = this.momentum.surface
        if (surface) {
            const polar = this.polar,
                  lx    = cos(polar[0]) * (polar[1] + 0.6 * this.r),
                  ly    = sin(polar[0]) * (polar[1] + 0.6 * this.r)
            lib.vfx.damage(surface, lx, ly, polar[0], this.color.high)
        }
        if (this.hp <= 0) kill(this, source)
    }

    hit(source) {
        if (!(source instanceof dna.space.Creature)) return

        if (this.tribe === source.tribe) {
            // try to procreature if fortunate
            if (this.isReadyToReproduce() && source.isReadyToReproduce()) {
                this.pay(env.tune.creature.procreationCost)
                source.pay(env.tune.creature.procreationCost)
                this.lastReproduction   = env.time
                source.lastReproduction = env.time

                const newBorn = lab.port.spawn( dna.space.Creature, {
                    tribe:  this.tribe,
                    alias:  this.name + '-' + source.name,
                    x:     .5 * (this.x + source.x),
                    y:     .5 * (this.y + source.y),
                })

                defer(() => {
                    newBorn.momentum.surfaceJumpAction(env.tune.creature.wakeUpJump)
                    newBorn.momentum.surfacePropelAction(env.tune.creature.wakeAcceleration)
                }, .1)
            }
        } else {
            // try to fight
            if (this.registerHit(source)) {
                //log(`${this.getTitle()} battles with ${source.getTitle()}`)
                // TODO determine the amount of damage based on speed/hight etc
                this.damage(source.hitForce, source)
                source.damage(this.hitForce, this)

                lib.sfx('punch')
            }
        }
    }

    pickUp(deposit) {
        if (!(deposit instanceof dna.space.MineralDeposit)) return

        this.collect(deposit.mass)
        lib.vfx.pickUp(lab.port, deposit.x, deposit.y, env.style.color.mineralDeposit.pickUp)
        lib.sfx('pickUp')
        kill(deposit)
    }

    evo(dt) {
        super.evo(dt)

        if (this._warped && math.length(this.x, this.y) < this.warpR) this._warped = false
    }

    draw() {
        const r = .5 * this.r, // calculate the visual base radius
              R = 2 * r,
              rh = .5 * r,
              hb = -.75 * r,

              hh = .7 * r,
              hw = 1.5 * r,
              eh = 0.34 * r,
              ew = 0.4 * r

        save()
        translate(this.x, this.y)
        rotate(this.dir)

        // lineWidth(1)
        fill(this.color.base)

        // body
        rect( -rh, -r, r, R )
        // head
        const hx = 0
        rect( hx, hb-hh, hw, hh)

        fill(env.style.color.eyes)
        rect(
            hx + 0.3 * r, hb-hh-.25*hh,
            eh, ew
        )
        rect(
            hx + hw - 0.3 * r, hb-hh-.25*hh,
            eh, ew
        )

        lineWidth(2)
        stroke(this.color.high)

        // hair
        line(hx + 0.6 * hw, hb-hh,
             hx + 0.6 * hw, hb-hh-.5*hh)

        // legs
        line(-.3*r, r, -.4*r, r + .6*r)
        line( .3*r, r,  .2*r, r + .6*r)

        super.draw()
        restore()
    }

    onBound(planet) {
        //log(`${this.getTitle()} bounded to the planet [${planet.name}]`)
        this._ls.forEach(e => {
            if (isFun(e.onBound)) e.onBound(planet)
        })
    }

    onTouchdown(planet) {
        //log(`${this.getTitle()} just landed on the planet [${planet.name}]`)
        this._ls.forEach(e => {
            if (isFun(e.onTouchdown)) e.onTouchdown(planet)
        })
        lib.sfx('touchdown')
    }

    onLaunch(planet) {
        //log(`${this.getTitle()} crossed the Karmal line of [${planet.name}]`)
        this._ls.forEach(e => {
            if (isFun(e.onLaunch)) e.onLaunch(planet)
        })
    }

    onRelease(planet) {
        //log(`${this.getTitle()} released from the planet [${planet.name}]`)
        this._ls.forEach(e => {
            if (isFun(e.onRelease)) e.onRelease(planet)
        })
    }

    isReadyToReproduce() {
        return (
               this.hp >= this.maxHP * env.tune.creature.procreationHealth
            && this.fortune >= env.tune.creature.procreationCost
            && this.lastReproduction + env.tune.creature.procreationBan < env.time
        )
    }

    warpSpace() {
        // log(`warping ${this.getTitle()}!`)
        if (this._warped) return
        lib.vfx.warpFX(lab.port, this.x, this.y, env.style.color.warp.out)
        this.x = -this.x
        this.y = -this.y
        lib.vfx.warpFX(lab.port, this.x, this.y, env.style.color.warp.back)
        this._warped = true
    }

    kill(source) {
        this.__.detach(this)
        log(`${this.getTitle()} is killed by ${source.getTitle()}`)

        if (this.surfaced) {
            const surface = this.momentum.surface
            const polar = this.polar,
                  lx    = cos(polar[0]) * (polar[1] - .7 * this.r),
                  ly    = sin(polar[0]) * (polar[1] - .7 * this.r)
            lib.vfx.zap(surface, lx, ly, polar[0], this.color.high)
        } else {
            lib.vfx.annihilate(lab.port, this.x, this.y, this.color.high)
        }
        lib.sfx('death')
    }

    getTitle() {
        return `[@${this.tribe}::${this.name}]`
    }

}
