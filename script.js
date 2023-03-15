const canvas = document.querySelector('canvas')
const ctx = canvas.getContext('2d')

const ui = document.querySelector('.ui')
const display = document.querySelector('.points')
const button = document.querySelector('.start')

const enemiesSpeed = [8, 7, 5]
const enemiesTypes = ['small', 'medium', 'big']
const colors = ['#50f72a', '#fcf638', '#fc4949', '#b50000']
const modes = ['Fácil', 'Médio', 'Difícil', 'Muito Difícil']
const gameTicks = {
  frame: 8,
  shoot: 9,
  enemy: 90,
  powerup: 800,
  explosion: 6
}

const gameContext = {
  started: false,
  gameover: false,
  ticks: Object.assign({}, gameTicks),
  bolts: [],
  enemies: [],
  explosions: [],
  powerups: [],
  nextframe: false,
  difficulty: gameTicks.enemy,
  images: null,
  parallax: null,
  stars: null,
  player: null,
  AudioManager:null, 
  keyPressed: {
    KeyA: false,
    KeyD: false
  }
}

// Class
class Background {
  constructor (x, y, width, height, speed) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.speed = speed
  }
}

class Player {
  constructor (x, y) {
    this.x = x
    this.y = y
    this.width = 32
    this.height = 48
    this.speed = 8
    this.direction = 1
    this.velocity = 0
    this.life = 5
    this.points = 0
  }
}

class Enemy {
  constructor (type, x, y, width, height, speed, life) {
    this.type = type
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.speed = speed
    this.life = life
  }
}

class Bolt {
  constructor (x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }
}

class Powerup {
  constructor (type, x, y, width, height, speed) {
    this.type = type
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.speed = speed
  }
}

class AudioManager {
  constructor() {
    this.context = new AudioContext()
    this.buffers = new Map()
  }

  async loadAudios () {
    const sounds = ['music', 'gameover', 'hit', 'battery', 'explosion']
    const promises = sounds.map(async sound => {
      const fetched = await fetch(`./assets/sounds/${sound}.ogg`)
      const arrayBuffer = await fetched.arrayBuffer()
      const decode = await this.context.decodeAudioData(arrayBuffer)
      this.buffers.set(sound, decode)
    })
    return Promise.all(promises)
  }

  play (name, volume = 0.5, loop = false) {
    const sound = this.buffers.get(name)
    const gainNode = this.context.createGain()
    const source = this.context.createBufferSource()

    source.connect(gainNode)
    gainNode.connect(this.context.destination)
    gainNode.gain.setValueAtTime(volume, this.context.currentTime)

    source.buffer = sound
    source.loop = loop
    source.start(0)
  }
}

// Load
function createImage (imageName) {
  const image = new Image()
  image.src = `./assets/images/${imageName}.png`
  return image
}

async function loadImages () {
  const names = ['ship', 'effects', 'powerup', 'enemy_small', 'enemy_medium', 'enemy_big', 'explosion', 'stars', 'parallax']
  const imgs = names.map(name => createImage(name))
  const images = {}

  for (const i in imgs) {
    images[names[i]] = imgs[i]
  }

  return images
}

// Draw
function drawBackground () {
  const parallax = gameContext.parallax
  const pxImage = gameContext.images.parallax

  ctx.drawImage(pxImage, parallax.x, parallax.y, parallax.width, parallax.height)
  ctx.drawImage(pxImage, parallax.x, parallax.y - parallax.height, parallax.width, parallax.height)

  const stars = gameContext.stars
  const stImage = gameContext.images.stars

  ctx.drawImage(stImage, stars.x, stars.y, stars.width, stars.height)
  ctx.drawImage(stImage, stars.x, stars.y - stars.height, stars.width, stars.height)
}

function drawEnemies () {
  const enemies = gameContext.enemies

  for (const enemy of enemies) {
    if (enemy.destroyed) {
      continue
    }

    const type = enemy.type
    const image = gameContext.images[`enemy_${type}`]

    ctx.drawImage(image, 0, 0, enemy.width, enemy.height, enemy.x, enemy.y, enemy.width, enemy.height)
  }
}

function drawBolts () {
  const bolts = gameContext.bolts
  const image = gameContext.images.effects

  for (const bolt of bolts) {
    if (!bolt.destroyed) {
      ctx.drawImage(image, 0, 32, 32, 32, bolt.x, bolt.y, 32, 32)
    }
  }
}

function drawPlayer () {
  const player = gameContext.player
  const image = gameContext.images.ship
  const drawX = player.direction * 32
  const drawY = gameContext.nextframe * player.height

  ctx.drawImage(image, drawX, drawY, player.width, player.height, player.x, player.y, player.width, player.height)
}

function drawExplosions () {
  const image = gameContext.images.explosion

  for (const explosion of gameContext.explosions) {
    const drawX = (32 * explosion.state)
    ctx.drawImage(image, drawX, 0, 32, 32, explosion.x, explosion.y, 32, 32)
  }
}

function drawPowerups () {
  const image = gameContext.images.powerup

  for (const powerup of gameContext.powerups) {
    ctx.drawImage(image, 0, 0, powerup.width, powerup.height, powerup.x, powerup.y, powerup.width, powerup.height)
  }
}

function drawHearts () {
  const image = gameContext.images.effects

  for (let i = 0; i < gameContext.player.life; i++) {
    const x = 5 + (17 * i) 
    ctx.drawImage(image, 0, 0, 32, 32, x, 10, 32, 32)
  }
}

function getDifficulty () {
  const ticks = gameContext.difficulty
  if (ticks >= 70) return 0 // Fácil
  if (ticks >= 50) return 1 // Médio
  if (ticks >= 35) return 2 // Difícil
  return 3                  // Muito Difícil
}

function drawTexts () {
  const points = gameContext.player.points
  const text = ctx.measureText(points)

  ctx.font = 'normal 25px Arial'
  ctx.strokeStyle = '#FFFFFF'
  ctx.strokeText(points, (canvas.width - text.width) - 15, 30)

  const difficulty = getDifficulty()

  ctx.font = '800 13px Arial'
  ctx.fillStyle = colors[difficulty]
  ctx.fillText(modes[difficulty], 10, 52)
}

function updateExplosionAnimation () {
  const explosions = gameContext.explosions

  for (const i in explosions) {
    const explosion = explosions[i]

    explosion.ticks--

    if (!explosion.ticks) {
      explosion.ticks = gameTicks.explosion
      explosion.state++

      if (explosion.state >= 5) {
        explosions.splice(i, 1)
      }
    }
  }
}

function draw () {
  if (!gameContext.started) {
    return
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  updateExplosionAnimation()
  drawBackground()
  drawEnemies()
  drawBolts()
  drawPlayer()
  drawExplosions()
  drawPowerups()
  drawHearts()
  drawTexts()
  
  window.requestAnimationFrame(draw)
}

// Utils
function explosion (x, y) {
  gameContext.explosions.push({ x, y, state: 0, tick: 6 })
}

function destroyEnemy (index) {
  const enemy = gameContext.enemies[index]
  const player = gameContext.player

  enemy.destroyed = true
  player.points++

  if (gameContext.difficulty > 30 && player.points % 10 === 0) {
    gameContext.difficulty -= 5
  }

  if (enemy.y < canvas.height) {
    const x = (enemy.x + (enemy.width / 2)) - 16
    const y = (enemy.y + (enemy.height / 2)) - 16
  
    explosion(x, y)
  }

  gameContext.audioManager.play('explosion', 1.5)
}

function random (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

// Update
function collides (entity, target) {
  const entity_width = entity.x + entity.width
  const entity_height = entity.y + entity.height

  const target_width = target.x + target.width
  const target_height = target.y + target.height

  const overlapW = entity.x < target_width && entity_width > target.x
  const overlapH = entity.y < target_height && entity_height > target.y

  return overlapW && overlapH
}

function updateTicks () {
  const ticks = gameContext.ticks

  for (const tick in ticks) {
    ticks[tick]--
  }

  if (!ticks.frame) {
    ticks.frame = gameTicks.frame
    gameContext.nextframe = !gameContext.nextframe
  }
}

function updateBackground () {
  const parallax = gameContext.parallax

  parallax.y += parallax.speed

  if (parallax.y >= parallax.height) {
    parallax.y = 0
  }

  const stars = gameContext.stars

  stars.y += stars.speed

  if (stars.y >= stars.height) {
    stars.y = 0
  }
}

function shoot () {
  const player = gameContext.player
  const bolts = gameContext.bolts

  bolts.push(new Bolt(player.x, player.y, 32, 32))
}

function updatePlayer () {
  const player = gameContext.player

  player.x += player.velocity

  if (player.x < 0) {
    player.x = 0
  }

  if ((player.x + player.width) > canvas.width) {
    player.x = canvas.width - player.width
  }
}

function updateBolts () {
  const bolts = gameContext.bolts
  const enemies = gameContext.enemies
  const ticks = gameContext.ticks

  if (!ticks.shoot) {
    ticks.shoot = gameTicks.shoot
    gameContext.bolts = gameContext.bolts.filter(bolt => !bolt.destroyed)
    shoot()
  }

  for (const i in bolts) {
    const bolt = bolts[i]

    if (bolt.destroyed) {
      continue
    }

    bolt.y -= 10

    if ((bolt.y + 32) < 0) {
      bolt.destroyed = true
      continue
    }

    for (const index in enemies) {
      const enemy = enemies[index]

      if (!enemy.destroyed && collides(bolt, enemy)) {
        bolt.destroyed = true
        enemy.life--

        if (!enemy.life) {
          destroyEnemy(index)
        }
      }
    }
  }
}

function gameOver () {
  gameContext.started = false

  window.clearInterval(gameContext.interval)
  gameContext.interval = null

  gameContext.player.x = (canvas.width / 2) - 16
  gameContext.player.direction = 1
  gameContext.gameover = true
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  drawBackground()
  drawPlayer()

  gameContext.audioManager.play('gameover', 0.6)

  const points = gameContext.player.points
  display.innerText = `${points} Pontos`
  display.classList.remove('hidden')
  ui.classList.remove('hidden')
}

function damage () {
  gameContext.player.life--

  if (gameContext.player.life <= 0) {
    gameOver()
  } else {
    gameContext.audioManager.play('hit', 0.5)
  }
}

function spawnEnemy () {
  gameContext.enemies = gameContext.enemies.filter(enemy => !enemy.destroyed)

  const enemies = gameContext.enemies

  const chance = random(1, 100)
  const rnd = chance <= 50 ? 0 : (chance <= 80 ? 1 : 2)
  const life = rnd + 2

  const type = enemiesTypes[rnd]
  const speed = enemiesSpeed[rnd]

  const image = gameContext.images[`enemy_${type}`]
  const x = random(0, canvas.width - image.width)

  enemies.push(new Enemy(type, x, -100, image.width / 2, image.height, speed, life))
}

function updateEnemies () {
  const enemies = gameContext.enemies

  for (const i in enemies) {
    const enemy = enemies[i]

    if (enemy.destroyed) {
      continue
    }

    enemy.y += enemy.speed

    if (enemy.y > canvas.height) {
      enemy.destroyed = true
      damage()
    } else if (collides(gameContext.player, enemy)) {
      destroyEnemy(i)
      damage()
    }
  }

  const ticks = gameContext.ticks

  if (!ticks.enemy) {
    ticks.enemy = random(gameContext.difficulty, gameContext.difficulty + 20)
    spawnEnemy()
  }
}

const powerup_effects = {
  battery: () => {
    gameContext.player.life++
    gameContext.audioManager.play('battery', 1.5)
  }
}

function spawnPowerup () {
  const powerups = gameContext.powerups
  const x = random(0, canvas.width - 32)
  powerups.push(new Powerup('battery', x, -100, 32, 32, 13))
}

function updatePowerups () {
  const powerups = gameContext.powerups

  for (const i in powerups) {
    const powerup = powerups[i]

    powerup.y += powerup.speed

    const collide = collides(gameContext.player, powerup)
    
    if (collide) {
      const exec = powerup_effects[powerup.type]
      if (exec) {
        exec()
      }
    }

    if (powerup.y > canvas.height || collide) {
      powerups.splice(i, 1)
    }
  }

  const ticks = gameContext.ticks

  if (!ticks.powerup) {
    ticks.powerup = random(gameTicks.powerup, gameTicks.powerup + 800)
    spawnPowerup()
  }
} 

function keyPressed (event) {
  event.stopPropagation()
  event.preventDefault()

  if (!gameContext.started || !(event.code in gameContext.keyPressed)) {
    return
  }

  gameContext.keyPressed[event.code] = true
  const player = gameContext.player

  switch (event.code) {
    case 'KeyA':
      player.direction = 0
      player.velocity = -player.speed
      break
    case 'KeyD':
      player.direction = 2
      player.velocity = player.speed
      break
  }
}

function keyNotPressed (event) {
  event.stopPropagation()
  event.preventDefault()

  if (!gameContext.started || !(event.code in gameContext.keyPressed)) {
    return
  }

  gameContext.keyPressed[event.code] = false
  const player = gameContext.player

  if (!gameContext.keyPressed.KeyA && !gameContext.keyPressed.KeyD) {
    player.velocity = 0
    player.direction = 1
    return
  }

  if (gameContext.keyPressed.KeyA) {
    player.direction = 0
    player.velocity = -player.speed
  } else {
    player.direction = 2
    player.velocity = player.speed
  }
}

function update () {
  updateTicks()
  updateBackground()
  updatePlayer()
  updateBolts()
  updateEnemies()
  updatePowerups()
}

function startTicks () {
  if (gameContext.interval) {
    window.clearInterval(gameContext.interval)
  }

  gameContext.interval = window.setInterval(update, 25)
}

function reset () {
  gameContext.parallax.y = 0
  gameContext.stars.y = 0
  gameContext.nextframe = false

  gameContext.player = new Player((canvas.width / 2) - 16, canvas.height - 100)
  gameContext.bolts.length = 0
  gameContext.enemies.length = 0
  gameContext.explosions.length = 0

  for (const tick in gameContext.ticks) {
    gameContext.ticks[tick] = gameTicks[tick]
  }

  startTicks()
}

function start () {
  ui.classList.add('hidden')
  gameContext.started = true
  
  if (gameContext.gameover) {
    reset()
  } else {
    startTicks()
    gameContext.audioManager.play('music', 0.3, true)
  }

  draw()
}

// Initilization
(async () => {
  gameContext.images = await loadImages()
  gameContext.parallax = new Background(0, 0, canvas.width, canvas.height * 2, 2)
  gameContext.stars = new Background(0, 0, canvas.width, canvas.height, 3)
  gameContext.player = new Player((canvas.width / 2) - 16, canvas.height - 100)

  gameContext.images.parallax.onload = () => {
    drawBackground()
    drawPlayer()
    button.addEventListener('click', start)
  }

  gameContext.audioManager = new AudioManager()
  await gameContext.audioManager.loadAudios()

  window.addEventListener('keydown', keyPressed)
  window.addEventListener('keyup', keyNotPressed)
})()
