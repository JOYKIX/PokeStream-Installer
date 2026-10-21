"use client";
import {useLayoutEffect} from "react";
// Scope the viewport to an editor, never to public OBS sources or regular pages.
// The root remains locked even while Radix temporarily changes body scroll styles.
export function useEditorViewport(editor:"studio"|"builder"|"theme"){
 useLayoutEffect(()=>{
  const root=document.documentElement,previous=root.dataset.editor;
  root.dataset.editor=editor;
  window.scrollTo({top:0,behavior:"instant"});
  return()=>{if(previous)root.dataset.editor=previous;else delete root.dataset.editor;};
 },[editor]);
}
