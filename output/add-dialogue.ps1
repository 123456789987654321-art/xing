Add-Type -AssemblyName System.Drawing
$source=(Get-Content "$PSScriptRoot/image-index.txt" -Encoding UTF8)[1]
$im=[System.Drawing.Image]::FromFile($source)
$canvas=New-Object System.Drawing.Bitmap($im.Width,$im.Height)
$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode='AntiAlias'
$g.TextRenderingHint='AntiAliasGridFit'
$g.DrawImage($im,0,0,$im.Width,$im.Height)
$ink=[System.Drawing.ColorTranslator]::FromHtml('#49301F')
$paper=[System.Drawing.ColorTranslator]::FromHtml('#FFFBEF')
$pen=New-Object System.Drawing.Pen($ink,3)
$fill=New-Object System.Drawing.SolidBrush($paper)
$textBrush=New-Object System.Drawing.SolidBrush($ink)
$font=New-Object System.Drawing.Font('Microsoft YaHei',23,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$fmt=New-Object System.Drawing.StringFormat
$fmt.Alignment='Center';$fmt.LineAlignment='Center'
function Bubble([float]$x,[float]$y,[float]$w,[float]$h,[float]$tx,[float]$ty,[string]$text){
 $path=New-Object System.Drawing.Drawing2D.GraphicsPath
 $r=34
 $path.AddArc($x,$y,$r,$r,180,90)
 $path.AddArc(($x+$w-$r),$y,$r,$r,270,90)
 $path.AddArc(($x+$w-$r),($y+$h-$r),$r,$r,0,90)
 $path.AddArc($x,($y+$h-$r),$r,$r,90,90)
 $path.CloseFigure()
 $anchor=[Math]::Max($x+30,[Math]::Min($x+$w-30,$tx))
 $edge=if($ty -lt $y){$y+2}else{$y+$h-2}
 $points=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($anchor-12,$edge),[System.Drawing.PointF]::new($tx,$ty),[System.Drawing.PointF]::new($anchor+12,$edge))
 $g.FillPolygon($fill,$points);$g.DrawPolygon($pen,$points)
 $g.FillPath($fill,$path);$g.DrawPath($pen,$path)
 $g.DrawLine((New-Object System.Drawing.Pen($paper,5)),($anchor-10),$edge,($anchor+10),$edge)
 $rect=[System.Drawing.RectangleF]::new($x+12,$y+8,$w-24,$h-16)
 $g.DrawString($text,$font,$textBrush,$rect,$fmt)
 $path.Dispose()
}
Bubble 330 35 290 95 500 153 "伤成这样……`n还能修好吗？"
Bubble 790 35 355 95 749 170 "能修！咱们先看看，`n哪些零件还能用。"
Bubble 35 658 245 75 200 625 '那我来整理！'
Bubble 315 646 340 94 480 608 "这几件还好，清理一下`n就能接着用。"
Bubble 715 649 350 90 1000 617 "还缺这几样，`n得出去找找。"
Bubble 1090 649 320 90 1280 617 "我知道哪里有！`n我带路！"
Bubble 50 976 335 80 265 944 "带上这盏灯，`n树荫底下有点暗。"
Bubble 478 978 320 78 590 947 "谢谢！这次我也`n要帮上忙。"
Bubble 1060 805 330 90 976 907 "准备好了吗？`n出发！"
$target=Join-Path $PSScriptRoot '修船的第一步-气泡版.png'
$canvas.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$canvas.Dispose();$im.Dispose()
Write-Output $target
