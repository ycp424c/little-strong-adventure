import type { GameModel, Kind } from '../src/game/model.ts'
export function recruitAndFuse(model:GameModel,kind:Kind,count:number) {
  if(model.status==='ready')model.start()
  for(let i=0;i<count;i++){
    model.recruit(kind)
    const recipe=model.fusionRecipes.find(r=>r.id===(kind==='melee'?'guard':'shooter')&&r.ready)
    if(recipe){model.openFusion();model.mergeRecipe(recipe.id)}
  }
}
