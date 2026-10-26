import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowRight, Shield, Sparkles, Swords, X } from 'lucide-react'
import type { GameModel } from '../game/model'
import { companionName, type CompanionForm } from '../game/companions'

type Props = {model:GameModel;onClose:()=>void;onMerge:(form:CompanionForm)=>void}
export function FusionMenu({model,onClose,onMerge}:Props) {
  const dialog=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:undefined
    dialog.current?.focus()
    return ()=>{if(previous?.isConnected)previous.focus()}
  },[])
  const trapFocus=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key!=='Tab')return
    const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement)
    if(index<0||(!event.shiftKey&&index===buttons.length-1)||(event.shiftKey&&index===0)){
      event.preventDefault();buttons[event.shiftKey?buttons.length-1:0]?.focus()
    }
  }
  return <div className="modal-scrim fusion-scrim">
    <div className="fusion-modal" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fusion-title" onKeyDown={trapFocus}>
      <button className="fusion-close" aria-label="关闭合成配方，继续游戏" onClick={onClose}><X size={19}/></button>
      <div className="card-kicker"><Sparkles size={13}/> CHOOSE YOUR SQUAD</div>
      <h2 id="fusion-title">三个伙伴，四种可能。</h2>
      <p>选择一级伙伴的配方。战斗已暂停，选好再出发。</p>
      {model.pendingAlly&&<div className="pending-note">候补：{companionName(model.pendingAlly)} × 1 · 暂不参战，合成腾位后加入</div>}
      <div className="fusion-recipes">{model.fusionRecipes.map(recipe=>{
        const Icon=recipe.id==='bulwark'||recipe.id==='guard'?Shield:Swords
        const melee=[...model.allies,...(model.pendingAlly?[model.pendingAlly]:[])].filter(a=>a.hp>0&&a.tier===1&&a.kind==='melee').length
        const ranged=[...model.allies,...(model.pendingAlly?[model.pendingAlly]:[])].filter(a=>a.hp>0&&a.tier===1&&a.kind==='ranged').length
        return <button key={recipe.id} className={`fusion-recipe form-${recipe.id}`} disabled={!recipe.ready} onClick={()=>onMerge(recipe.id)}>
          <div className="recipe-result"><span><Icon size={22}/></span><div><small>Ⅱ · {recipe.kind==='melee'?'近战体系':'远程体系'}</small><strong>{recipe.name}</strong></div></div>
          <p>{recipe.description}</p>
          <div className="recipe-materials">
            {recipe.melee>0&&<span className={melee>=recipe.melee?'enough':''}><img src={`${import.meta.env.BASE_URL}assets/melee.png`} alt=""/>近 {Math.min(melee,recipe.melee)}/{recipe.melee}</span>}
            {recipe.melee>0&&recipe.ranged>0&&<b>＋</b>}
            {recipe.ranged>0&&<span className={ranged>=recipe.ranged?'enough':''}><img src={`${import.meta.env.BASE_URL}assets/ranged.png`} alt=""/>远 {Math.min(ranged,recipe.ranged)}/{recipe.ranged}</span>}
          </div>
          <div className="recipe-action">{recipe.ready?'消耗上述伙伴，合成':'继续捕获一级伙伴'}<ArrowRight size={15}/></div>
        </button>
      })}</div>
      <div className="fusion-rule">二级 → 三级：仅三只同配方护卫自动合成，最高三级。</div>
    </div>
  </div>
}
